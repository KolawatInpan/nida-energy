const { prisma } = require('../../utils/prisma');

async function getBuildings(includeAll = false) {
    const where = includeAll ? {} : { approvalStatus: 'approved' };
    return await prisma.building.findMany({
        where,
        include: { owner: { select: { name: true, email: true, telNum: true } } },
    });
}

async function getBuilding(id) {
	  return await prisma.building.findUnique({ where: { id: parseInt(id) }, include: { owner: { select: { name: true, email: true, telNum: true } } } });
}

async function getTotalMeters(buildingId) {
    const count = await prisma.meterInfo.count({
        where: {
          building: {
            id: parseInt(buildingId)
          }
        }
    })
    return count;
}

async function getBuildingByEmail(email) {
    return await prisma.building.findMany({
      where: { email: email}
    })
}

async function createBuilding(name, mapURL, address, province, postalCode, email) {
  // email is now optional — Building can exist without an owner
  if (!name || !address || !province || !postalCode) {
    console.debug('createBuilding validation failed:', { name, address, province, postalCode });
    throw new Error('Required fields: name, address, province, postalCode');
  }
  console.debug('createBuilding model args:', { name, mapURL, address, province, postalCode, email });
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
        email: email || null,
        approvalStatus: 'pending',  // require admin approval
        status: 'INACTIVE',         // not operational until approved
    }
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
    data.status = String(updates.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
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
      throw new Error('Invalid tradeMode. Allowed values: SELF_CONSUME, MANUAL, AUTO_BATTERY_THRESHOLD');
    }
    data.tradeMode = normalizedMode;
  }

  if (updates.solarTradeMode !== undefined) {
    const normalized = String(updates.solarTradeMode || '').trim().toUpperCase();
    const allowed = new Set(['SELF_CONSUME', 'MANUAL', 'AUTO', 'AUTO_BATTERY_THRESHOLD']);
    if (!allowed.has(normalized)) {
      throw new Error('Invalid solarTradeMode. Allowed values: SELF_CONSUME, MANUAL, AUTO, AUTO_BATTERY_THRESHOLD');
    }
    data.solarTradeMode = normalized;
  }

  if (updates.batteryTradeMode !== undefined) {
    const normalized = String(updates.batteryTradeMode || '').trim().toUpperCase();
    const allowed = new Set(['SELF_CONSUME', 'MANUAL', 'AUTO_BATTERY_THRESHOLD']);
    if (!allowed.has(normalized)) {
      throw new Error('Invalid batteryTradeMode. Allowed values: SELF_CONSUME, MANUAL, AUTO_BATTERY_THRESHOLD');
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
  if (updates.email !== undefined) {
    data.email = String(updates.email || '').trim() || null;
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
    await prisma.$executeRawUnsafe(`UPDATE "Building" SET "id" = ${newId} WHERE "id" = ${buildingId}`);
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
    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { name: true, email: true } });
    if (!building) {
      const err = new Error('Building not found');
      err.code = 'P2025';
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      await tx.buildingAssignment.deleteMany({ where: { buildingId } });
      await tx.meterInfo.deleteMany({ where: { buildingName: building.name } });
      await tx.runningMeter.deleteMany({ where: { snid: { in: (await tx.meterInfo.findMany({ where: { buildingName: building.name }, select: { snid: true } })).map(m => m.snid) } } });
      if (building.email) await tx.wallet.deleteMany({ where: { email: building.email } });
      await tx.transaction.deleteMany({ where: { buildingName: building.name } });
      await tx.marketOrder.deleteMany({ where: { buildingName: building.name } });
      await tx.invoice.deleteMany({ where: { buildingName: building.name } });
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
    include: { owner: { select: { name: true, email: true } } },
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

// ---- User Assignment (M:N) ----

async function assignUserToBuilding(buildingId, userEmail, role = 'owner') {
  const bId = parseInt(buildingId, 10);
  if (!Number.isInteger(bId)) throw new Error('Invalid building id');
  if (!userEmail) throw new Error('userEmail is required');

  const assignment = await prisma.buildingAssignment.upsert({
    where: { buildingId_userEmail: { buildingId: bId, userEmail } },
    create: { buildingId: bId, userEmail, role },
    update: { role },
  });

  // If this is the first assignment (role=owner), also set Building.email
  const count = await prisma.buildingAssignment.count({ where: { buildingId: bId } });
  if (count === 1 || role === 'owner') {
    await prisma.building.update({
      where: { id: bId },
      data: { email: userEmail },
    });
  }

  // Ensure wallet exists for this building (create if not, tied to building ID not user)
  const walletId = String(bId);
  const existingWallet = await prisma.wallet.findUnique({ where: { id: walletId }, select: { id: true } });
  if (!existingWallet) {
    try {
      await prisma.wallet.create({
        data: { id: walletId, email: userEmail, isCustodial: true, chain: 'ethereum', tokenBalance: 0, quota: 0 },
      });
    } catch (err) {
      if (err?.code !== 'P2002') console.warn('Wallet create on assign failed:', userEmail, err?.message || err);
    }
  }

  return assignment;
}

async function removeUserFromBuilding(buildingId, userEmail) {
  const bId = parseInt(buildingId, 10);
  if (!Number.isInteger(bId)) throw new Error('Invalid building id');
  if (!userEmail) throw new Error('userEmail is required');

  // Use deleteMany to avoid error when no assignment record exists
  await prisma.buildingAssignment.deleteMany({
    where: { buildingId: bId, userEmail },
  });

  // Clear the Building.email FK if this was the assigned user
  const building = await prisma.building.findUnique({ where: { id: bId }, select: { email: true } });
  if (building?.email === userEmail) {
    const remaining = await prisma.buildingAssignment.findFirst({
      where: { buildingId: bId },
      orderBy: { createdAt: 'asc' },
    });
    await prisma.building.update({
      where: { id: bId },
      data: { email: remaining?.userEmail || null },
    });
  }
}

async function getBuildingAssignments(buildingId) {
  const bId = parseInt(buildingId, 10);
  return prisma.buildingAssignment.findMany({
    where: { buildingId: bId },
    include: { user: { select: { name: true, email: true, role: true, status: true } } },
  });
}

module.exports = {
  getBuildings,
  getBuilding,
  getTotalMeters,
  getBuildingByEmail,
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



