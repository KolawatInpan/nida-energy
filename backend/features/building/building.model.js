const { prisma } = require('../../utils/prisma');

async function getBuildings(includeAll = false) {
    const where = includeAll ? {} : { approvalStatus: 'approved' };
    return await prisma.building.findMany({
        where,
        include: {
            assignedUsers: {
                include: { user: { select: { credId: true, name: true, email: true, role: true } } },
            },
            wallet: { select: { id: true, tokenBalance: true } },
            meters: true,
        },
    });
}

async function getBuilding(id) {
    return await prisma.building.findUnique({
        where: { id: parseInt(id) },
        include: {
            assignedUsers: {
                include: { user: { select: { credId: true, name: true, email: true, role: true } } },
            },
            wallet: { select: { id: true, tokenBalance: true } },
            meters: true,
        },
    });
}

async function getTotalMeters(buildingId) {
    const count = await prisma.meterInfo.count({
        where: {
            building: { id: parseInt(buildingId) },
        },
    });
    return count;
}

async function getBuildingsByUserId(userId) {
    if (!userId) return [];
    const assignments = await prisma.buildingAssignment.findMany({
        where: { userId },
        include: { building: true },
    });
    return assignments.map((a) => a.building);
}

async function createBuilding(name, mapURL, address, province, postalCode, assignedContactEmail) {
    if (!name || !address || !province || !postalCode) {
        throw new Error('Required fields: name, address, province, postalCode');
    }
    const maxId = await prisma.building.aggregate({ _max: { id: true } });
    const nextId = (maxId._max.id || 0) + 1;
    const newBuilding = await prisma.building.create({
        data: {
            id: nextId,
            name,
            mapURL: mapURL || null,
            address,
            province,
            postal: postalCode,
            assignedContactEmail: assignedContactEmail || null,
            approvalStatus: 'pending',
            status: 'INACTIVE',
        },
    });
    return newBuilding;
}

async function updateBuilding(id, updates = {}) {
    let buildingId = parseInt(id, 10);
    if (!Number.isInteger(buildingId)) {
        throw new Error('Invalid building id');
    }

    const existing = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!existing) {
        throw new Error('Building not found');
    }

    const data = {};
    if (updates.status !== undefined) {
        data.status =
            String(updates.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE'
                ? 'INACTIVE'
                : 'ACTIVE';
    }

    if (updates.approvalStatus !== undefined) {
        const val = String(updates.approvalStatus || '').trim().toLowerCase();
        if (['pending', 'approved', 'rejected'].includes(val)) {
            data.approvalStatus = val;
            if (val === 'approved') data.status = 'ACTIVE';
            if (val === 'rejected') data.status = 'INACTIVE';
        }
    }

    if (updates.tradeMode !== undefined) {
        const normalizedMode = String(updates.tradeMode || '').trim().toUpperCase();
        const allowedModes = new Set(['SELF_CONSUME', 'MANUAL', 'AUTO_BATTERY_THRESHOLD']);
        if (!allowedModes.has(normalizedMode)) {
            throw new Error(
                'Invalid tradeMode. Allowed values: SELF_CONSUME, MANUAL, AUTO_BATTERY_THRESHOLD'
            );
        }
        data.tradeMode = normalizedMode;
    }

    if (updates.solarTradeMode !== undefined) {
        const normalized = String(updates.solarTradeMode || '').trim().toUpperCase();
        const allowed = new Set(['SELF_CONSUME', 'MANUAL', 'AUTO', 'AUTO_BATTERY_THRESHOLD']);
        if (!allowed.has(normalized)) {
            throw new Error(
                'Invalid solarTradeMode. Allowed values: SELF_CONSUME, MANUAL, AUTO, AUTO_BATTERY_THRESHOLD'
            );
        }
        data.solarTradeMode = normalized;
    }

    if (updates.batteryTradeMode !== undefined) {
        const normalized = String(updates.batteryTradeMode || '').trim().toUpperCase();
        const allowed = new Set(['SELF_CONSUME', 'MANUAL', 'AUTO_BATTERY_THRESHOLD']);
        if (!allowed.has(normalized)) {
            throw new Error(
                'Invalid batteryTradeMode. Allowed values: SELF_CONSUME, MANUAL, AUTO_BATTERY_THRESHOLD'
            );
        }
        data.batteryTradeMode = normalized;
    }

    if (updates.tradeMeterType !== undefined) {
        const normalizedMeterType = String(updates.tradeMeterType || '').trim().toLowerCase();
        const allowedMeterTypes = new Set(['consume', 'produce', 'battery']);
        if (!allowedMeterTypes.has(normalizedMeterType)) {
            throw new Error('Invalid tradeMeterType. Allowed values: consume, produce, battery');
        }
        data.tradeMeterType = normalizedMeterType;
    }

    if (updates.batterySellThreshold !== undefined) {
        const threshold = Number(updates.batterySellThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
            throw new Error('batterySellThreshold must be a number between 0 and 100');
        }
        data.batterySellThreshold = threshold;
    }

    if (updates.solarSelfPercent !== undefined) {
        const p = Number(updates.solarSelfPercent);
        if (!Number.isFinite(p) || p < 0 || p > 100) {
            throw new Error('solarSelfPercent must be a number between 0 and 100');
        }
        data.solarSelfPercent = p;
    }

    if (updates.batteryBidPrice !== undefined) {
        const v = Number(updates.batteryBidPrice);
        if (!Number.isFinite(v) || v < 0) {
            throw new Error('batteryBidPrice must be a non-negative number');
        }
        data.batteryBidPrice = v;
    }

    if (updates.batteryOfferPrice !== undefined) {
        const v = Number(updates.batteryOfferPrice);
        if (!Number.isFinite(v) || v < 0) {
            throw new Error('batteryOfferPrice must be a non-negative number');
        }
        data.batteryOfferPrice = v;
    }

    if (updates.solarOfferPrice !== undefined) {
        const v = Number(updates.solarOfferPrice);
        if (!Number.isFinite(v) || v < 0) {
            throw new Error('solarOfferPrice must be a non-negative number');
        }
        data.solarOfferPrice = v;
    }

    // Editable building info fields
    if (updates.name !== undefined && String(updates.name || '').trim()) {
        data.name = String(updates.name).trim();
    }
    if (updates.address !== undefined) {
        data.address = String(updates.address || '').trim();
    }
    if (updates.province !== undefined) {
        data.province = String(updates.province || '').trim();
    }
    if (updates.postalCode !== undefined) {
        data.postal = String(updates.postalCode || '').trim();
    }
    if (updates.assignedContactEmail !== undefined) {
        data.assignedContactEmail = String(updates.assignedContactEmail || '').trim() || null;
    }
    if (updates.mapURL !== undefined) {
        data.mapURL = String(updates.mapURL || '').trim() || null;
    }

    const nextMode = data.tradeMode || existing.tradeMode;
    if (nextMode === 'AUTO_BATTERY_THRESHOLD') {
        data.tradeMeterType = 'battery';
    } else if (nextMode === 'SELF_CONSUME') {
        data.tradeMeterType = 'produce';
    }

    if (!Object.keys(data).length && updates.id === undefined) {
        return existing;
    }

    // Handle ID change via raw SQL (Prisma can't update @id field normally)
    if (updates.id !== undefined) {
        const newId = parseInt(updates.id, 10);
        if (!Number.isInteger(newId) || newId <= 0) throw new Error('Invalid building id');
        await prisma.$executeRawUnsafe(
            `UPDATE "Building" SET "id" = ${newId} WHERE "id" = ${buildingId}`
        );
        buildingId = newId;
    }

    if (!Object.keys(data).length) {
        return prisma.building.findUnique({ where: { id: buildingId } });
    }

    return prisma.building.update({
        where: { id: buildingId },
        data,
    });
}

async function deleteBuilding(id, force = false) {
    const buildingId = parseInt(id, 10);
    if (!Number.isInteger(buildingId)) {
        throw new Error('Invalid building id');
    }

    if (force) {
        const building = await prisma.building.findUnique({
            where: { id: buildingId },
            select: { name: true },
        });
        if (!building) {
            const err = new Error('Building not found');
            err.code = 'P2025';
            throw err;
        }

        return prisma.$transaction(async (tx) => {
            await tx.buildingAssignment.deleteMany({ where: { buildingId } });
            const meters = await tx.meterInfo.findMany({
                where: { buildingName: building.name },
                select: { snid: true },
            });
            const snids = meters.map((m) => m.snid);
            if (snids.length > 0) {
                await tx.runningMeter.deleteMany({ where: { snid: { in: snids } } });
                await tx.hourlyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.dailyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.weeklyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
                await tx.monthlyEnergy.deleteMany({ where: { meterSnid: { in: snids } } });
            }
            await tx.meterInfo.deleteMany({ where: { buildingName: building.name } });

            // Wallet is per building (1:1) — everything that points at it has to
            // go first, otherwise the deletes below fail with P2003. A building
            // that actually traded owns matches / receipts / ledger rows, and
            // those used to make `?force=true` refuse to delete it at all.
            const wallets = await tx.wallet.findMany({ where: { buildingId }, select: { id: true } });
            const walletIds = wallets.map((w) => w.id);

            const orders = await tx.marketOrder.findMany({
                where: {
                    OR: [
                        { buildingName: building.name },
                        ...(walletIds.length ? [{ walletId: { in: walletIds } }] : []),
                    ],
                },
                select: { id: true },
            });
            const orderIds = orders.map((o) => o.id);
            if (orderIds.length > 0) {
                await tx.marketMatch.deleteMany({
                    where: { OR: [{ buyerOrderId: { in: orderIds } }, { sellerOrderId: { in: orderIds } }] },
                });
            }
            await tx.marketOrder.deleteMany({ where: { id: { in: orderIds } } });

            const invoices = await tx.invoice.findMany({
                where: { buildingName: building.name },
                select: { id: true },
            });
            const invoiceIds = invoices.map((i) => i.id);
            if (invoiceIds.length > 0) {
                await tx.receipt.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
            }
            await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });

            if (walletIds.length > 0) {
                await tx.walletTx.deleteMany({ where: { walletId: { in: walletIds } } });
            }
            // Ledger rows may carry only the wallet or only the building id
            await tx.transaction.deleteMany({
                where: {
                    OR: [
                        { buildingName: building.name },
                        { buildingId },
                        ...(walletIds.length ? [{ walletId: { in: walletIds } }] : []),
                    ],
                },
            });
            await tx.wallet.deleteMany({ where: { buildingId } });
            return tx.building.delete({ where: { id: buildingId } });
        });
    }

    return prisma.building.delete({
        where: { id: buildingId },
    });
}

// ---- Building Approval ----

async function getPendingBuildings() {
    return prisma.building.findMany({
        where: { approvalStatus: 'pending' },
        include: {
            assignedUsers: {
                include: { user: { select: { name: true, email: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}

async function approveBuilding(id) {
    const buildingId = parseInt(id, 10);
    if (!Number.isInteger(buildingId)) throw new Error('Invalid building id');
    return prisma.building.update({
        where: { id: buildingId },
        data: { approvalStatus: 'approved', status: 'ACTIVE' },
    });
}

async function rejectBuilding(id) {
    const buildingId = parseInt(id, 10);
    if (!Number.isInteger(buildingId)) throw new Error('Invalid building id');
    return prisma.building.update({
        where: { id: buildingId },
        data: { approvalStatus: 'rejected', status: 'INACTIVE' },
    });
}

// ---- User Assignment (M:N via BuildingAssignment) ----

async function assignUserToBuilding(buildingId, userId, role = 'member') {
    const bId = parseInt(buildingId, 10);
    if (!Number.isInteger(bId)) throw new Error('Invalid building id');
    if (!userId) throw new Error('userId is required');

    const assignment = await prisma.buildingAssignment.upsert({
        where: { buildingId_userId: { buildingId: bId, userId } },
        create: { buildingId: bId, userId, role },
        update: { role },
    });

    // Ensure wallet exists for this building (create if not)
    const existingWallet = await prisma.wallet.findUnique({
        where: { buildingId: bId },
        select: { id: true },
    });
    if (!existingWallet) {
        const { randomUUID } = require('crypto');
        try {
            await prisma.wallet.create({
                data: {
                    id: randomUUID(),
                    buildingId: bId,
                    isCustodial: true,
                    chain: 'ethereum',
                    tokenBalance: 0,
                    quota: 0,
                },
            });
        } catch (err) {
            if (err?.code !== 'P2002')
                console.warn('Wallet create on assign failed:', err?.message || err);
        }
    }

    return assignment;
}

async function removeUserFromBuilding(buildingId, userId) {
    const bId = parseInt(buildingId, 10);
    if (!Number.isInteger(bId)) throw new Error('Invalid building id');
    if (!userId) throw new Error('userId is required');

    await prisma.buildingAssignment.deleteMany({
        where: { buildingId: bId, userId },
    });
}

async function getBuildingAssignments(buildingId) {
    const bId = parseInt(buildingId, 10);
    return prisma.buildingAssignment.findMany({
        where: { buildingId: bId },
        include: {
            user: { select: { credId: true, name: true, email: true, role: true, status: true } },
        },
    });
}

module.exports = {
    getBuildings,
    getBuilding,
    getTotalMeters,
    getBuildingsByUserId,
    createBuilding,
    updateBuilding,
    deleteBuilding,
    getPendingBuildings,
    approveBuilding,
    rejectBuilding,
    assignUserToBuilding,
    removeUserFromBuilding,
    getBuildingAssignments,
};
