const { prisma } = require('../../utils/prisma');

async function getBuildings() {
	  return await prisma.building.findMany();
}

async function getBuilding(id) {
	  return await prisma.building.findUnique({ where: { id: parseInt(id) } });
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
  // mapURL is optional (user may not provide Google Maps URL)
  if (!name || !address || !province || !postalCode || !email) {
    console.debug('createBuilding validation failed:', { name, address, province, postalCode, email });
    throw new Error('All fields are required');
  }
  console.debug('createBuilding model args:', { name, mapURL, address, province, postalCode, email });
  const newBuilding = await prisma.building.create({
    data: {
        name,
        mapURL: mapURL || null,
        address,
        province,
        postal: postalCode,
        email
    }
  });

  return newBuilding;
}

async function updateBuilding(id, updates = {}) {
  const buildingId = parseInt(id, 10);
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

  const nextMode = data.tradeMode || existing.tradeMode;
  if (nextMode === 'AUTO_BATTERY_THRESHOLD') {
    data.tradeMeterType = 'battery';
  } else if (nextMode === 'SELF_CONSUME') {
    data.tradeMeterType = 'produce';
  }

  if (!Object.keys(data).length) {
    return existing;
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
    // Force delete: remove all related records first
    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { name: true, email: true } });
    if (!building) {
      const err = new Error('Building not found');
      err.code = 'P2025';
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      // Delete meters
      await tx.meterInfo.deleteMany({ where: { buildingName: building.name } });
      // Delete energy records
      await tx.runningMeter.deleteMany({ where: { snid: { in: (await tx.meterInfo.findMany({ where: { buildingName: building.name }, select: { snid: true } })).map(m => m.snid) } } });
      // Delete wallet
      await tx.wallet.deleteMany({ where: { email: building.email } });
      // Delete transactions
      await tx.transaction.deleteMany({ where: { buildingName: building.name } });
      // Delete market orders
      await tx.marketOrder.deleteMany({ where: { buildingName: building.name } });
      // Delete invoices
      await tx.invoice.deleteMany({ where: { buildingName: building.name } });
      // Finally delete building
      return tx.building.delete({ where: { id: buildingId } });
    });
  }

  return prisma.building.delete({
    where: { id: buildingId },
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
};



