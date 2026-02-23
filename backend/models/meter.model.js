const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function createMeter(snid, buildingName, capacity, type) {
  const building = await prisma.building.findUnique({ where: { name: buildingName } });
  if (!building) {
    throw new Error('Building not found');
  }
  const newMeter = await prisma.meterInfo.create({
    data: {
      snid,
      buildingId: building.id,
      capacity,
      type
    }
  });
  return newMeter;
}

module.exports = {
  getMeters,
  getMetersByBuilding,
  getApprovedMeters,
  getApprovedMetersByBuilding,
  getPendingMeters,
  getRejectedMeters,
  createMeter
};
