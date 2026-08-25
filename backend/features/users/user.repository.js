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
    const maxSeq = await prisma.user.aggregate({ _max: { userId: true } });
    const seqId = (maxSeq._max.userId || 0) + 1;
    return await prisma.user.create({
        data: { name, email, passwordHash: hashedPassword, credId, userId: seqId, role },
        include: { credentials: true, wallets: true },
    });
}

async function updateUser(credId, data) {
    const { getCurrentPrisma } = require('../../utils/prisma');
    const db = getCurrentPrisma();

    const userData = { ...data };
    const userId = userData.userId;
    delete userData.userId;

    const updated = await db.user.update({
        where: { credId: String(credId) },
        data: userData,
        include: { credentials: true, wallets: true },
    });

    // Force userId update via raw SQL (defense in depth)
    if (userId !== undefined) {
        const num = userId === null ? null : Number(userId);
        await db.$executeRawUnsafe(`UPDATE "User" SET "userId" = ${num === null ? 'NULL' : num} WHERE "credId" = '${String(credId)}'`);
        updated.userId = num;
    }

    return updated;
}

/**
 * Change a user's email address across ALL related tables in one transaction.
 * email is the User primary key; FK tables (Wallet, Building, BuildingAssignment,
 * MarketOrder) cascade automatically via ON UPDATE CASCADE, but Notification and
 * ActivityLog store email as a plain string — those are updated manually here.
 *
 * @param {string} credId - current user credId
 * @param {string} newEmail - new email address
 * @returns {Promise<object>} updated user
 */
async function updateUserEmail(credId, newEmail) {
    const { getCurrentPrisma } = require('../../utils/prisma');
    const db = getCurrentPrisma();

    const target = await db.user.findUnique({ where: { credId: String(credId) } });
    if (!target) throw new Error('User not found');
    const oldEmail = target.email;
    const cleanNew = String(newEmail || '').trim().toLowerCase();

    if (!cleanNew) throw new Error('Email is required');
    if (cleanNew === oldEmail) return target; // no change

    // Duplicate check (email is unique PK)
    const existing = await db.user.findUnique({ where: { email: cleanNew } });
    if (existing) throw new Error('Email already in use by another user');

    await db.$transaction(async (tx) => {
        // 1. Update User PK — FK tables (Wallet/Building/BuildingAssignment/MarketOrder)
        //    cascade automatically because they are ON UPDATE CASCADE.
        await tx.user.update({ where: { credId: String(credId) }, data: { email: cleanNew } });

        // 2. Plain-string email tables — must be updated manually
        await tx.notification.updateMany({ where: { email: oldEmail }, data: { email: cleanNew } });
        await tx.activityLog.updateMany({ where: { email: oldEmail }, data: { email: cleanNew } });
    });

    const updated = await db.user.findUnique({
        where: { credId: String(credId) },
        include: { credentials: true, wallets: true },
    });
    return sanitizeUser(updated);
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

    const user = await prisma.user.findUnique({ where: { credId: String(credId) } });
    if (!user) throw new Error('User not found');
    const email = user.email;

    const { getCurrentPrisma } = require('../../utils/prisma');
    const currentDb = getCurrentPrisma();

    // ── Step 1: Unlink user from buildings (don't delete buildings or wallets!) ──
    await currentDb.buildingAssignment.deleteMany({ where: { userEmail: email } });
    await currentDb.building.updateMany({
        where: { email },
        data: { email: null },
    });

    // ── Step 2: Delete only user-owned records (not building/wallet/invoice) ──
    await currentDb.userCredential.deleteMany({ where: { credId: String(credId) } });
    await currentDb.notification.deleteMany({ where: { email } });
    await currentDb.activityLog.deleteMany({ where: { email } });
    await currentDb.user.delete({ where: { credId: String(credId) } });
}

// ---- User Approval ----

async function getPendingUsers() {
    return prisma.user.findMany({
        where: { status: 'pending', role: 'USER' },
        orderBy: { createdAt: 'desc' },
    });
}

async function approveUser(email) {
    return prisma.user.update({
        where: { email },
        data: { status: 'approved' },
    });
}

async function rejectUser(email) {
    return prisma.user.update({
        where: { email },
        data: { status: 'rejected' },
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
    updateUserEmail,
    deleteUser,
    getPendingUsers,
    approveUser,
    rejectUser,
};
