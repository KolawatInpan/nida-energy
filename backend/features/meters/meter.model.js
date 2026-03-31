const { prisma } = require('../../utils/prisma');

async function getMeters() {
  const meters = await prisma.meterInfo.findMany({
    include: {
      building: {
        select: {
          owner: {select: { name: true, email: true }}}}}
  });
  return meters;
}

async function getMetersByBuilding(buildingId) {
  const id = parseInt(buildingId);
  const meters = await prisma.meterInfo.findMany({
    where: { building: { id } },
    include: { building: { include: { owner: { select: { name: true, email: true } } } } }
  });

  return meters;
}

async function getMeterBySnid(snid) {
  if (!snid || String(snid).trim() === '') return null;

  const meter = await prisma.meterInfo.findUnique({
    where: { snid: String(snid) },
    include: {
      building: {
        include: {
          owner: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  return meter;
}

async function getApprovedMeters() {
  const meters = await prisma.meterInfo.findMany({ 
    where: { approveStatus: "approved" }, 
    include: { building: { include: { owner: { select: { name: true, email: true } } } } } });
  return meters;
}

async function getApprovedMetersByBuilding(buildingId) {
  const meters = await prisma.meterInfo.findMany({ 
    where: { 
      buildingId: parseInt(buildingId), approveStatus: "approved" }, 
      include: { building: { include: { owner: { select: { name: true, email: true } } } } } });
  return meters;
}

async function getPendingMeters() {
  const meters = await prisma.meterInfo.findMany({ 
    where: { approveStatus: "pending" }, 
    include: { building: { include: { owner: { select: { name: true, email: true } } } } } });
  return meters;
}

async function getRejectedMeters() {
  const meters = await prisma.meterInfo.findMany({ 
    where: { approveStatus: "rejected" }, 
    include: { building: { include: { owner: { select: { name: true, email: true } } } } } });
  return meters;
}

async function createMeter(buildingIdOrName, meterType, meterNumber, capacity, dateInstalled) {
  // buildingIdOrName may be numeric id or building name
  let building = null;
  if (!buildingIdOrName) throw new Error('Missing building identifier');
  if (typeof buildingIdOrName === 'number' || String(buildingIdOrName).match(/^\d+$/)) {
    const id = parseInt(buildingIdOrName);
    building = await prisma.building.findUnique({ where: { id } });
  } else {
    building = await prisma.building.findUnique({ where: { name: String(buildingIdOrName) } });
  }
  if (!building) {
    throw new Error('Building not found');
  }

  // determine meter type and boolean flags for compatibility
  const lowerType = String(meterType || '').toLowerCase();
  const produceMeter = lowerType === 'producer';
  const consumeMeter = lowerType === 'consumer';
  const batMeter = lowerType === 'battery';

  // normalized `type` string to store in DB (useful for frontend)
  let normalizedType = null;
  if (produceMeter) normalizedType = 'Produce';
  else if (consumeMeter) normalizedType = 'Consume';
  else if (batMeter) normalizedType = 'Battery';
  else if (meterType && typeof meterType === 'string') normalizedType = meterType;

  const now = new Date();
  const newMeter = await prisma.meterInfo.create({
    data: {
      snid: String(meterNumber),
      buildingName: building.name,
      meterName: String(meterNumber),
      capacity: capacity ? parseInt(capacity) : null,
      type: normalizedType,
      dateInstalled: dateInstalled ? new Date(dateInstalled) : null,
      dateSubmit: now,
      approveStatus: 'pending'
    }
  });
  return newMeter;
}

async function updateMeter(snid, updates = {}) {
  if (!snid || String(snid).trim() === '') {
    throw new Error('Invalid meter id');
  }

  const existing = await prisma.meterInfo.findUnique({
    where: { snid: String(snid) },
  });
  if (!existing) {
    throw new Error('Meter not found');
  }

  const data = {};

  if (updates.buildingName !== undefined) {
    const buildingName = String(updates.buildingName || '').trim();
    if (buildingName) {
      const building = await prisma.building.findUnique({ where: { name: buildingName } });
      if (!building) throw new Error('Building not found');
      data.buildingName = buildingName;
    }
  }

  if (updates.type !== undefined) {
    const type = String(updates.type || '').trim();
    data.type = type || existing.type;
  }

  if (updates.capacity !== undefined) {
    data.capacity = updates.capacity === '' || updates.capacity === null ? null : Number(updates.capacity);
  }

  if (updates.status !== undefined) {
    const status = String(updates.status || '').trim().toLowerCase();
    data.approveStatus = ['approved', 'pending', 'rejected'].includes(status) ? status : existing.approveStatus;
  }

  return prisma.meterInfo.update({
    where: { snid: String(snid) },
    data,
    include: {
      building: {
        include: {
          owner: { select: { name: true, email: true } },
        },
      },
    },
  });
}

async function deleteMeter(snid) {
  if (!snid || String(snid).trim() === '') {
    throw new Error('Invalid meter id');
  }

  return prisma.$transaction(async (tx) => {
    await tx.runningMeter.deleteMany({ where: { snid: String(snid) } });
    await tx.hourlyEnergy.deleteMany({ where: { meterId: String(snid) } });
    await tx.dailyEnergy.deleteMany({ where: { meterId: String(snid) } });
    await tx.weeklyEnergy.deleteMany({ where: { meterId: String(snid) } });
    await tx.monthlyEnergy.deleteMany({ where: { meterId: String(snid) } });

    return tx.meterInfo.delete({
      where: { snid: String(snid) },
    });
  });
}

module.exports = {
  getMeters,
  getMetersByBuilding,
  getMeterBySnid,
  getApprovedMeters,
  getApprovedMetersByBuilding,
  getPendingMeters,
  getRejectedMeters,
  createMeter,
  updateMeter,
  deleteMeter
};


