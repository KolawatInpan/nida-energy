const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

async function getUsers() {
  return await prisma.user.findMany({ include: { credentials: true, wallets: true } });
}

async function getUserByBuildingName(buildingName) {
  if (!buildingName || String(buildingName).trim() === '') return null;
  // get User from email from building (await the DB call)
  const building = await prisma.building.findUnique({ where: { name: buildingName }, select: { email: true } });
  const buildingEmail = building?.email;
  if (!buildingEmail) return null;
  return await prisma.user.findUnique({ where: { email: buildingEmail }, include: { wallets: true, credentials: true } });
}

async function getUserById(credId) {
  if (!credId || String(credId).trim() === '') return null;
  return await prisma.user.findUnique({ where: { credId }, include: { wallets: true, credentials: true } });
}

async function getUserByEmail(email) {
  if (!email) return null;
  return await prisma.user.findUnique({ where: { email }, include: { wallets: true, credentials: true } });
}


module.exports = {
  getUsers,
  getUserById,
  getUserByEmail,
  getUserByBuildingName
};
