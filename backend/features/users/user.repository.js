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

/**
 * Delete all mode-specific data for a user from ONE database.
 * Used by deleteUser to clean both real and demo before deleting shared data.
 */
async function cleanModeSpecificData(prismaClient, email, buildingNames, buildingIds) {
    await prismaClient.$transaction(async (tx) => {
        const wallets = await tx.wallet.findMany({ where: { email }, select: { id: true } });
        const walletIds = wallets.map(w => w.id);

        // MarketMatch → MarketOrder
        const orders = await tx.marketOrder.findMany({
            where: { OR: [{ participantEmail: email }, ...(buildingNames.length > 0 ? [{ buildingName: { in: buildingNames } }] : [])] },
            select: { id: true },
        });
        const orderIds = orders.map(o => o.id);
        if (orderIds.length > 0) {
            await tx.marketMatch.deleteMany({ where: { OR: [{ buyerOrderId: { in: orderIds } }, { sellerOrderId: { in: orderIds } }] } });
        }
        await tx.marketOrder.deleteMany({ where: { OR: [{ participantEmail: email }, ...(buildingNames.length > 0 ? [{ buildingName: { in: buildingNames } }] : [])] } });

        // Energy data
        if (buildingNames.length > 0) {
            const meters = await tx.meterInfo.findMany({ where: { buildingName: { in: buildingNames } }, select: { snid: true } });
            const snids = meters.map(m => m.snid);
            if (snids.length > 0) {
                await tx.hourlyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.dailyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.weeklyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.monthlyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.runningMeter.deleteMany({ where: { snid: { in: snids } } });
            }
        }

        // Invoice → Receipt
        if (buildingNames.length > 0) {
            const invoices = await tx.invoice.findMany({ where: { buildingName: { in: buildingNames } }, select: { id: true } });
            const invoiceIds = invoices.map(i => i.id);
            if (invoiceIds.length > 0) {
                await tx.receipt.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
            }
            await tx.invoice.deleteMany({ where: { buildingName: { in: buildingNames } } });
        }

        // EnergyOffer & EnergyBid
        if (walletIds.length > 0) {
            await tx.energyOffer.deleteMany({ where: { sellerWalletId: { in: walletIds } } });
            await tx.energyBid.deleteMany({ where: { buyerWalletId: { in: walletIds } } });
        }

        // Transaction
        await tx.transaction.deleteMany({ where: { OR: [{ walletId: { in: walletIds } }, ...(buildingIds.length > 0 ? [{ buildingId: { in: buildingIds } }] : [])] } });

        // WalletTx → Wallet
        if (walletIds.length > 0) {
            await tx.walletTx.deleteMany({ where: { walletId: { in: walletIds } } });
        }
        await tx.wallet.deleteMany({ where: { email } });
    });
}

async function deleteUser(credId) {
    if (!credId || String(credId).trim() === '') throw new Error('Invalid user id');

    // Read from shared (real) DB via proxy
    const user = await prisma.user.findUnique({ where: { credId: String(credId) } });
    if (!user) throw new Error('User not found');
    const email = user.email;

    // Gather IDs from shared tables (always reads real)
    const buildings = await prisma.building.findMany({ where: { email }, select: { id: true, name: true } });
    const buildingIds = buildings.map(b => b.id);
    const buildingNames = buildings.map(b => b.name);

    // ── Step 1: Clean mode-specific data ──
    // Real mode → clean BOTH | Demo mode → clean demo ONLY
    const { realPrisma, demoPrisma, getCurrentMode, REAL_MODE } = require('../../utils/prisma');
    const isRealMode = getCurrentMode() === REAL_MODE;
    await cleanModeSpecificData(demoPrisma, email, buildingNames, buildingIds);
    if (isRealMode) {
        await cleanModeSpecificData(realPrisma, email, buildingNames, buildingIds);
    }

    // ── Step 2: Delete shared tables via proxy ──
    // Proxy handles mode: Real → both | Demo → demo only
    if (buildingNames.length > 0) {
        await prisma.meterInfo.deleteMany({ where: { buildingName: { in: buildingNames } } });
    }
    if (buildingIds.length > 0) {
        await prisma.battery.deleteMany({ where: { buildingId: { in: buildingIds } } });
    }
    await prisma.building.deleteMany({ where: { email } });

    await prisma.userCredential.deleteMany({ where: { credId: String(credId) } });
    await prisma.notification.deleteMany({ where: { email } });
    await prisma.activityLog.deleteMany({ where: { email } });
    await prisma.user.delete({ where: { credId: String(credId) } });
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
    deleteUser,
};
