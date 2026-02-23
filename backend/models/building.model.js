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

async function createBuilding(name, url, fullAddr, province, postalCode, email) {
    if (!name || !url || !fullAddr || !province || !postalCode || !email) {
        throw new Error('All fields are required');
    }
    const newBuilding = await prisma.building.create({
        data: {
            name,
            url,
            fullAddr,
            province,
            postalCode,
            email
        }
    });
    return newBuilding;
}

module.exports = {
  getBuildings,
  getBuilding,
  getTotalMeters,
  getBuildingByEmail,
  createBuilding,
};

