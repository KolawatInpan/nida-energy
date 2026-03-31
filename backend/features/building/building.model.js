const { prisma } = require('../../utils/prisma');
const WalletModel = require('../wallets/wallet.model');

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
  // Attempt to auto-create a custodial wallet for the building owner/email.
  try {
    await WalletModel.createWallet({ buildingId: newBuilding.id, email });
  } catch (err) {
    // Log but do not fail building creation if wallet creation fails
    console.warn('Auto-create wallet failed for building:', newBuilding.id, err);
  }

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



