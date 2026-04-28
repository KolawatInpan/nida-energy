// แจ้งเตือนการขายไฟ (manual/auto)
async function notifySellElectricity({ userId, amount, mode, buildingId, meterId }) {
    try {
        const { createNotification } = require('../notification/notification.service');
        await createNotification({
            type: 'sell_electricity',
            message: `คุณขายไฟ (${mode === 'AUTO_BATTERY_THRESHOLD' ? 'Auto' : 'Manual'}) จำนวน ${amount} kWh สำเร็จ`,
            userId,
            buildingId,
            meterId
        });
    } catch (e) { console.error('Notification error:', e.message); }
}
const { prisma } = require('../../utils/prisma');
const WalletModel = require('../wallets/wallet.model');
const BuildingModel = require('../building/building.model');
const { DEFAULT_ENERGY_RATE } = require('../rates/rate.helpers');

const TRADE_MODES = {
    SELF_CONSUME: 'SELF_CONSUME',
    MANUAL: 'MANUAL',
    AUTO_BATTERY_THRESHOLD: 'AUTO_BATTERY_THRESHOLD',
};

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo4(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 10000) / 10000;
}

function normalizeTradeMode(value) {
    const normalized = String(value || TRADE_MODES.MANUAL).trim().toUpperCase();
    if (Object.values(TRADE_MODES).includes(normalized)) {
        return normalized;
    }
    return TRADE_MODES.MANUAL;
}

function isProduceMeter(type = '') {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('produce') || normalized.includes('producer') || normalized.includes('solar') || normalized.includes('pv');
}

function isConsumeMeter(type = '') {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('consume') || normalized.includes('consumer') || normalized.includes('smart meter') || normalized.includes('load');
}

function isBatteryMeter(type = '') {
    return String(type || '').toLowerCase().includes('battery');
}

async function getLatestEnergyRatePrice() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "EnergyRateRule" (
                id INTEGER PRIMARY KEY,
                display_id TEXT UNIQUE NOT NULL,
                rate_type TEXT NOT NULL,
                price NUMERIC(12,4) NOT NULL,
                effective_start DATE NOT NULL,
                effective_end DATE NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        const rows = await prisma.$queryRawUnsafe(`
            SELECT price
            FROM "EnergyRateRule"
            WHERE effective_end IS NULL OR effective_end >= CURRENT_DATE
            ORDER BY effective_start DESC, id DESC
            LIMIT 1
        `);

        const value = toNumber(rows?.[0]?.price);
        return value > 0 ? value : DEFAULT_ENERGY_RATE;
    } catch (err) {
        console.warn('getLatestEnergyRatePrice fallback to default:', err?.message || err);
        return DEFAULT_ENERGY_RATE;
    }
}

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

    if (normalizedSourceType === 'consume') {
        return normalizedType.includes('consume') || normalizedType.includes('consumer') || normalizedType.includes('smart meter') || normalizedType.includes('load');
    }

    return normalizedType.includes('produce') || normalizedType.includes('producer') || normalizedType.includes('solar') || normalizedType.includes('pv');
}

async function createOffer({ sellerWalletId, kwh, ratePerKwh, sourceType = 'produce', trigger = 'manual' }) {
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
                const tradeMode = normalizeTradeMode(building?.tradeMode);

                if (String(trigger || 'manual').toLowerCase() === 'manual' && tradeMode !== TRADE_MODES.MANUAL) {
                    throw new Error(`Manual sell is disabled for mode ${tradeMode}. Please switch mode to MANUAL to post offers manually.`);
                }
                
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

async function autoPostBatterySurplusOffer(buildingName) {
    if (!buildingName) {
        return { created: null, reason: 'missing-building' };
    }

    const building = await prisma.building.findUnique({
        where: { name: String(buildingName) },
        select: {
            name: true,
            email: true,
            tradeMode: true,
            batterySellThreshold: true,
        }
    });

    if (!building) {
        return { created: null, reason: 'building-not-found' };
    }

    const mode = normalizeTradeMode(building.tradeMode);
    if (mode !== TRADE_MODES.AUTO_BATTERY_THRESHOLD) {
        return { created: null, reason: 'mode-not-auto' };
    }

    const meterRows = await prisma.meterInfo.findMany({
        where: { buildingName: building.name },
        select: { snid: true, type: true, value: true, kWH: true, capacity: true }
    });

    const produceMeters = meterRows.filter((meter) => isProduceMeter(meter.type));
    const consumeMeters = meterRows.filter((meter) => isConsumeMeter(meter.type));
    const batteryMeter = meterRows.find((meter) => isBatteryMeter(meter.type));

    if (!batteryMeter || produceMeters.length === 0) {
        return { created: null, reason: 'required-meter-missing' };
    }

    const produced = produceMeters.reduce((sum, meter) => sum + Math.max(toNumber(meter.value), toNumber(meter.kWH)), 0);
    const consumed = consumeMeters.reduce((sum, meter) => sum + Math.max(toNumber(meter.value), toNumber(meter.kWH)), 0);
    const batteryCurrent = Math.max(toNumber(batteryMeter.value), toNumber(batteryMeter.kWH));
    const batteryCapacity = toNumber(batteryMeter.capacity);

    if (batteryCapacity <= 0) {
        return { created: null, reason: 'invalid-battery-capacity' };
    }

    const thresholdPct = Math.min(100, Math.max(0, toNumber(building.batterySellThreshold)));
    const thresholdKwh = (batteryCapacity * thresholdPct) / 100;
    const batteryExcess = Math.max(0, batteryCurrent - thresholdKwh);
    const productionSurplus = Math.max(0, produced - consumed);
    const sellableKwh = roundTo4(Math.min(batteryExcess, productionSurplus));

    if (sellableKwh < 0.01) {
        return { created: null, reason: 'no-sellable-surplus' };
    }

    const wallet = await prisma.wallet.findFirst({
        where: { email: String(building.email || '') },
        select: { id: true }
    });

    if (!wallet?.id) {
        return { created: null, reason: 'seller-wallet-not-found' };
    }

    const ratePerKwh = await getLatestEnergyRatePrice();

    const created = await createOffer({
        sellerWalletId: wallet.id,
        kwh: sellableKwh,
        ratePerKwh,
        sourceType: 'battery',
        trigger: 'auto',
    });

    return { created, reason: 'created' };
}

module.exports = {
    getOffers,
    getAvailableOffers,
    getSoldOffers,
    getOfferById,
    getBuildingByWalletId
    ,
    createOffer,
    autoPostBatterySurplusOffer
}


