const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOffers() {
    return await prisma.energyOffer.findMany({ 
        include: { market: true } });
}

async function getAvailableOffers() {
    return await prisma.energyOffer.findMany({ 
        where: { status: 'AVAILABLE' }, 
        include: { market: true }});
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

module.exports = {
    getOffers,
    getAvailableOffers,
    getSoldOffers,
    getOfferById
}