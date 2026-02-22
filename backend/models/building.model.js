const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getBuildings() {
	  return await prisma.building.findMany();
}

async function getBuilding(id) {
	  return await prisma.building.findUnique({ where: { id: parseInt(id) } });
}

async function getTotalMeters(buildingId) {
  const count = await prisma.meterInfo.count({
    include {
      
    }
  })
  return count;
}

module.exports = {
  getBuildings,
  getBuilding,
  getTotalMeters
};

