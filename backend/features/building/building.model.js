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

  // สร้าง notification สำหรับ admin
  try {
    const { createNotification } = require('../notification/notification.service');
    await createNotification({
      type: 'building_added',
      message: `มีการเพิ่มตึกใหม่: ${name}`,
      userId: null,
      buildingId: newBuilding.id
    });
  } catch (e) { console.error('Notification error:', e.message); }

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

async function deleteBuilding(id) {
  const buildingId = parseInt(id, 10);
  if (!Number.isInteger(buildingId)) {
    throw new Error('Invalid building id');
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



