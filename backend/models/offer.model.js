const { PrismaClient } = require('@prisma/client');
const WalletModel = require('./wallet.model');
const BuildingModel = require('./building.model');
const prisma = new PrismaClient();

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
        where: { status: 'SOLD' }, 
        include: { market: true }});
}

async function getOfferById(id) {
    return await prisma.energyOffer.findUnique({ 
        where: { id: parseInt(id) },
        include: { market: true }});
}

async function getBuildingByWalletId(walletId) {
    // sellerwallet and building link with email
    const wallet = await WalletModel.getWalletById(walletId);
    if (!wallet) {
        throw new Error('Wallet not found');
    }
    const building = await BuildingModel.getBuilding(wallet.id);
    return building;
}

module.exports = {
    getOffers,
    getAvailableOffers,
    getSoldOffers,
    getOfferById,
    getBuildingByWalletId
}