const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a meter (MeterInfo) and perform minimal seeding if required.
async function createMeterWithSeed({ meterName, buildingId, SN = null, produceMeter = false, consumeMeter = false, batMeter = false, capacity = null, dateInstalled = null }) {
  if (!meterName) {
    const e = new Error('meterName required');
    e.status = 400;
    throw e;
  }
  // resolve building
  const b = await prisma.building.findUnique({ where: { id: Number(buildingId) } }) || await prisma.building.findUnique({ where: { name: String(buildingId) } });
  if (!b) {
    const e = new Error('building not found');
    e.status = 404;
    throw e;
  }
  // check existing by meterName
  const existing = await prisma.meterInfo.findUnique({ where: { meterName } });
  if (existing) {
    const err = new Error('meter exists');
    err.code = 'EEXIST';
    throw err;
  }

  const snid = SN || (`sn-${Date.now()}-${Math.floor(Math.random()*100000)}`);
  const createData = {
    snid,
    meterName,
    buildingName: b.name,
    produceMeter,
    consumeMeter,
    batMeter,
    // new meters require approval; set to "pending" until admin approves
    approveStatus: "pending",
    // record when this meter was submitted
    dateSubmit: new Date(),
  };
  if (capacity) createData.capacity = capacity;
  if (dateInstalled) createData.dateInstalled = new Date(dateInstalled);

  const created = await prisma.meterInfo.create({ data: createData });

  // No dashboard model in Prisma schema; leave seeding to other processes if needed.

  return created;
}

async function getMeterByName(meterName) {
  return await prisma.meterInfo.findUnique({ where: { meterName } });
}

async function getMeterBySNID(snid) {
  return await prisma.meterInfo.findUnique({ where: { snid } });
}

async function listMetersByBuilding(buildingIdOrName) {
  let b = null;
  if (!isNaN(Number(buildingIdOrName))) b = await prisma.building.findUnique({ where: { id: Number(buildingIdOrName) } });
  if (!b) b = await prisma.building.findUnique({ where: { name: String(buildingIdOrName) } });
  if (!b) return [];
  return await prisma.meterInfo.findMany({ where: { buildingName: b.name }, orderBy: { meterName: 'asc' } });
}

async function getPendingMeters() {
  // pending = string state 'pending'
  const rows = await prisma.meterInfo.findMany({
    where: { approveStatus: 'pending' },
    orderBy: { dateSubmit: 'desc' },
    include: { building: { include: { owner: true } } }
  });
  // flatten owner/building info for easier consumption by controllers/frontend
  return rows.map(r => {
    const owner = r.building && r.building.owner ? r.building.owner : null;
    return Object.assign({}, r, {
      buildingName: r.buildingName,
      building: r.building ? r.building.name : null,
      ownerName: owner ? owner.name : null,
      ownerEmail: owner ? owner.email : (r.building ? r.building.email : null),
      ownerPhone: owner ? owner.telNum : (r.building ? r.building.telNum : null),
    });
  });
}

async function getApprovedMeters() {
  const rows = await prisma.meterInfo.findMany({ where: { approveStatus: 'approved' }, orderBy: { meterName: 'asc' }, include: { building: { include: { owner: true } } } });
  return rows.map(r => {
    const owner = r.building && r.building.owner ? r.building.owner : null;
    return Object.assign({}, r, {
      buildingName: r.buildingName,
      building: r.building ? r.building.name : null,
      ownerName: owner ? owner.name : null,
      ownerEmail: owner ? owner.email : (r.building ? r.building.email : null),
      ownerPhone: owner ? owner.telNum : (r.building ? r.building.telNum : null),
    });
  });
}


async function approveMeter(snid, approve = true) {
  if (!snid) {
    const e = new Error('snid required'); e.status = 400; throw e;
  }
  const meter = await prisma.meterInfo.findUnique({ where: { snid } });
  if (!meter) {
    const e = new Error('meter not found'); e.status = 404; throw e;
  }
  const updated = await prisma.meterInfo.update({ where: { snid }, data: { approveStatus: approve ? 'approved' : 'rejected' } });
  return updated;
}

module.exports = { createMeterWithSeed, getMeterByName, getMeterBySNID, listMetersByBuilding, getPendingMeters, getApprovedMeters, approveMeter };
