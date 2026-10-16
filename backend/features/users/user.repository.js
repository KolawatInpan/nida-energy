const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

function sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
}

async function getUsers() {
    const users = await prisma.user.findMany({
        include: { credentials: true, buildingAssignments: { include: { building: true } } },
    });
    return users.map(sanitizeUser);
}

// ── Building ↔ User lookups (via BuildingAssignment M:N) ──

async function getUserByBuildingName(buildingName) {
    if (!buildingName || String(buildingName).trim() === '') return null;
    const building = await prisma.building.findUnique({
        where: { name: buildingName },
        select: { id: true },
    });
    if (!building) return null;

    // Find user via BuildingAssignment
    const assignment = await prisma.buildingAssignment.findFirst({
        where: { buildingId: building.id },
        include: { user: { include: { credentials: true, buildingAssignments: true } } },
    });
    if (!assignment?.user) return null;
    return sanitizeUser(assignment.user);
}

async function getUserByBuildingId(buildingId) {
    if (!buildingId) return null;
    const assignment = await prisma.buildingAssignment.findFirst({
        where: { buildingId: Number(buildingId) },
        include: { user: { include: { credentials: true, buildingAssignments: true } } },
    });
    if (!assignment?.user) return null;
    return sanitizeUser(assignment.user);
}

async function getUserById(credId) {
    if (!credId || String(credId).trim() === '') return null;
    const user = await prisma.user.findUnique({
        where: { credId },
        include: { credentials: true, buildingAssignments: { include: { building: true } } },
    });
    return sanitizeUser(user);
}

// ── Email lookups (email is now SHARED — may return multiple users) ──

async function getUsersByEmail(email) {
    if (!email) return [];
    const users = await prisma.user.findMany({
        where: { email },
        include: { credentials: true, buildingAssignments: { include: { building: true } } },
    });
    return users.map(sanitizeUser);
}

async function findUsersByEmailRaw(email) {
    if (!email) return [];
    return await prisma.user.findMany({
        where: { email },
        include: { credentials: true, buildingAssignments: { include: { building: true } } },
    });
}

async function findUserByEmailRaw(email) {
    // Legacy compat — returns first user with this email
    const users = await findUsersByEmailRaw(email);
    return users[0] || null;
}

// ── User CRUD ──

async function createUser({ name, email, hashedPassword, role = 'USER' }) {
    const credId = randomUUID();
    const maxSeq = await prisma.user.aggregate({ _max: { userId: true } });
    const seqId = (maxSeq._max.userId || 0) + 1;
    return await prisma.user.create({
        data: { name, email, passwordHash: hashedPassword, credId, userId: seqId, role },
        include: { credentials: true, buildingAssignments: true },
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
        include: { credentials: true, buildingAssignments: { include: { building: true } } },
    });

    // Force userId update via raw SQL (defense in depth)
    if (userId !== undefined) {
        const num = userId === null ? null : Number(userId);
        await db.$executeRawUnsafe(
            `UPDATE "User" SET "userId" = ${num === null ? 'NULL' : num} WHERE "credId" = '${String(credId)}'`
        );
        updated.userId = num;
    }

    return updated;
}

async function deleteUser(credId) {
    if (!credId || String(credId).trim() === '') throw new Error('Invalid user id');

    const user = await prisma.user.findUnique({ where: { credId: String(credId) } });
    if (!user) throw new Error('User not found');

    const { getCurrentPrisma } = require('../../utils/prisma');
    const currentDb = getCurrentPrisma();

    // ── Step 1: Remove building assignments ──
    await currentDb.buildingAssignment.deleteMany({ where: { userId: String(credId) } });

    // ── Step 2: Delete user-owned records ──
    await currentDb.userCredential.deleteMany({ where: { credId: String(credId) } });
    await currentDb.notification.deleteMany({ where: { userId: String(credId) } });
    await currentDb.activityLog.deleteMany({ where: { userId: String(credId) } });
    await currentDb.marketOrder.updateMany({
        where: { participantId: String(credId) },
        data: { participantId: null },
    });
    await currentDb.user.delete({ where: { credId: String(credId) } });
}

// ---- User Approval ----

async function getPendingUsers() {
    return prisma.user.findMany({
        where: { status: 'pending', role: 'USER' },
        orderBy: { createdAt: 'desc' },
    });
}

async function approveUser(credId) {
    return prisma.user.update({
        where: { credId },
        data: { status: 'approved' },
    });
}

async function rejectUser(credId) {
    return prisma.user.update({
        where: { credId },
        data: { status: 'rejected' },
    });
}

module.exports = {
    sanitizeUser,
    getUsers,
    getUserByBuildingName,
    getUserById,
    getUsersByEmail,
    findUserByEmailRaw,
    findUsersByEmailRaw,
    getUserByBuildingId,
    createUser,
    updateUser,
    deleteUser,
    getPendingUsers,
    approveUser,
    rejectUser,
};
