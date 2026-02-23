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

async function getUserByBuildingId(buildingId) {
  if (!buildingId) return null;
  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { email: true } });
  const buildingEmail = building?.email;
  if (!buildingEmail) return null;
  return await prisma.user.findUnique({ where: { email: buildingEmail }, include: { wallets: true, credentials: true } });
}

async function registerUser(name, email, password) {
  if (!name || !email || !password) {
    throw new Error('Name, email, and password are required');
  }
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const credId = randomUUID();
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashedPassword,
      credId
    },
    include: { credentials: true, wallets: true },
  });
  return newUser;
}

module.exports = {
  getUsers,
  getUserById,
  getUserByEmail,
  getUserByBuildingName,
  getUserByBuildingId,
  registerUser,
};
