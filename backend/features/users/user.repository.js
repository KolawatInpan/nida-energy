const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

function sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
}

async function getUsers() {
    const users = await prisma.user.findMany({ include: { credentials: true, wallets: true } });
    return users.map(sanitizeUser);
}

async function getUserByBuildingName(buildingName) {
    if (!buildingName || String(buildingName).trim() === '') return null;
    const building = await prisma.building.findUnique({ where: { name: buildingName }, select: { email: true } });
    if (!building?.email) return null;
    const user = await prisma.user.findUnique({ where: { email: building.email }, include: { wallets: true, credentials: true } });
    return sanitizeUser(user);
}

async function getUserById(credId) {
    if (!credId || String(credId).trim() === '') return null;
    const user = await prisma.user.findUnique({ where: { credId }, include: { wallets: true, credentials: true } });
    return sanitizeUser(user);
}

async function getUserByEmail(email) {
    if (!email) return null;
    const user = await prisma.user.findUnique({ where: { email }, include: { wallets: true, credentials: true } });
    return sanitizeUser(user);
}

async function getUserByBuildingId(buildingId) {
    if (!buildingId) return null;
    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { email: true } });
    if (!building?.email) return null;
    const user = await prisma.user.findUnique({ where: { email: building.email }, include: { wallets: true, credentials: true } });
    return sanitizeUser(user);
}

async function findUserByEmailRaw(email) {
    return await prisma.user.findUnique({ where: { email }, include: { credentials: true, wallets: true } });
}

async function createUser({ name, email, hashedPassword, role = 'USER' }) {
    const credId = randomUUID();
    return await prisma.user.create({
        data: { name, email, passwordHash: hashedPassword, credId, role },
        include: { credentials: true, wallets: true },
    });
}

async function updateUser(credId, data) {
    return await prisma.user.update({
        where: { credId: String(credId) },
        data,
        include: { credentials: true, wallets: true },
    });
}

module.exports = {
    sanitizeUser,
    getUsers,
    getUserByBuildingName,
    getUserById,
    getUserByEmail,
    getUserByBuildingId,
    findUserByEmailRaw,
    createUser,
    updateUser,
};
