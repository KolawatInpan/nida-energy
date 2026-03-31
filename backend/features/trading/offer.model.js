const { prisma } = require('../../utils/prisma');
const WalletModel = require('../wallets/wallet.model');
const BuildingModel = require('../building/building.model');

async function getOffers() {
    return await prisma.energyOffer.findMany();
}

async function getAvailableOffers() {
    return await prisma.energyOffer.findMany({
        where: { status: 'AVAILABLE'}
    })
}

async function getSoldOffers() {
    return await prisma.energyOffer.findMany({ 
        where: { status: 'SOLD' }
    });
}

async function getOfferById(id) {
    return await prisma.energyOffer.findUnique({ 
        where: { id: parseInt(id) }
    });
}

async function getBuildingByWalletId(walletId) {
    // sellerwallet and building link with email
    const wallet = await WalletModel.getWalletById(walletId);
    if (!wallet) {
        throw new Error('Wallet not found');
    }
    
    // Get buildings by wallet's email
    const buildings = await BuildingModel.getBuildingByEmail(wallet.email);
    if (!buildings || buildings.length === 0) {
        throw new Error('Building not found for wallet email');
    }
    
    // Return the first building (most cases have 1 building per email)
    return buildings[0];
}

function matchesSourceType(type = '', sourceType = 'produce') {
    const normalizedType = String(type || '').toLowerCase();
    const normalizedSourceType = String(sourceType || 'produce').toLowerCase();

    if (normalizedSourceType === 'battery') {
        return normalizedType.includes('battery');
    }

    return normalizedType.includes('produce') || normalizedType.includes('producer') || normalizedType.includes('solar') || normalizedType.includes('pv');
}

async function createOffer({ sellerWalletId, kwh, ratePerKwh, sourceType = 'produce' }) {
    if (!sellerWalletId || kwh == null || ratePerKwh == null) {
        throw new Error('Missing required fields for createOffer');
    }

    // Lazy-load to avoid circular dependency:
    // invoice.service -> offer.model -> energyAggregation -> invoice.service
    const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');
    
    // Use transaction to create offer and decrease producer meter value atomically
    const result = await prisma.$transaction(async (tx) => {
        const totalPrice = Number(kwh) * Number(ratePerKwh);
        
        // Create the offer
        const created = await tx.energyOffer.create({
            data: {
                sellerWalletId: String(sellerWalletId),
                kWH: Number(kwh),
                ratePerkWH: Number(ratePerKwh),
                totalPrice: Number(totalPrice),
                status: 'AVAILABLE'
            }
        });
        
        // Decrease producer meter value for seller's building
        const wallet = await WalletModel.getWalletById(sellerWalletId);
        if (wallet) {
            const buildings = await BuildingModel.getBuildingByEmail(wallet.email);
            if (buildings && buildings.length > 0) {
                const building = buildings[0];
                
                const meterRows = await tx.meterInfo.findMany({
                    where: {
                        buildingName: building.name,
                    }
                });

                const selectedMeter = meterRows.find((meter) => matchesSourceType(meter.type, sourceType));

                if (!selectedMeter) {
                    throw new Error(`${String(sourceType || 'produce')} meter not found for seller building`);
                }

                const currentValue = Number(selectedMeter.value || 0);
                const currentKwh = Number(selectedMeter.kWH || 0);
                const availableEnergy = Math.max(currentValue, currentKwh);
                const sellAmount = Number(kwh);

                if (sellAmount > availableEnergy) {
                    throw new Error(`Cannot create offer exceeding ${String(sourceType || 'produce')} meter energy. Available: ${availableEnergy}`);
                }
                
                await tx.meterInfo.update({
                    where: { snid: selectedMeter.snid },
                    data: {
                        value: Math.max(0, currentValue - sellAmount),
                        kWH: Math.max(0, currentKwh - sellAmount),
                        timestamp: new Date(),
                    }
                });

                await syncBuildingEnergyForBuilding(building.name, tx);
            }
        }
        
        return created;
    });
    
    return result;
}

module.exports = {
    getOffers,
    getAvailableOffers,
    getSoldOffers,
    getOfferById,
    getBuildingByWalletId
    ,
    createOffer
}


