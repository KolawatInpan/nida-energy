const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getTransactions() {
    return await prisma.transaction.findMany();
}

async function getTransactionById(id) {
    return await prisma.transaction.findUnique({ where: { id: parseInt(id) } });
}

async function getTransactionsByBuilding(buildingId) {
    return await prisma.transaction.findMany({ where: { buildingId: parseInt(buildingId) } });
}


module.exports = {
    getTransactions,
    getTransactionById,
    getTransactionsByBuilding,
}