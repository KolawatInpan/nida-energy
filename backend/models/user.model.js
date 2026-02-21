const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

async function createUser(name, email, password, role = 'CONSUMER', telNum = null) {
  if (!name || !email || !password) {
    const e = new Error('name, email and password are required');
    e.status = 400;
    throw e;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const e = new Error('Email already registered');
    e.status = 409;
    throw e;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const credId = randomUUID();
  const user = await prisma.user.create({ data: { credId, name, email, passwordHash, role, telNum: telNum || null } });
  try {
    await prisma.userCredential.create({ data: { credId: user.credId, type: 'PASSWORD', identifier: email } });
  } catch (e) {
    // ignore credential creation errors
  }
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

async function authenticateUser(email, password) {
  if (!email || !password) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

async function getAllUsers() {
  return await prisma.user.findMany({ include: { credentials: true, wallets: true } });
}

async function getUserById(credId) {
  if (!credId || String(credId).trim() === '') return null;
  return await prisma.user.findUnique({ where: { credId }, include: { wallets: true, credentials: true } });
}

async function getUserByEmail(email) {
  if (!email) return null;
  return await prisma.user.findUnique({ where: { email }, include: { wallets: true, credentials: true } });
}

async function updateUserByEmail(email, data) {
  return prisma.user.update({ where: { email }, data });
}

async function deleteUserByEmail(email) {
  return prisma.user.delete({ where: { email } });
}

// UserCredential CRUD
async function createCredential({ credId, type = 'PASSWORD', identifier = null }) {
  return prisma.userCredential.create({ data: { credId, type, identifier } });
}

async function getCredential(credId) {
  return prisma.userCredential.findMany({ where: { credId } });
}

async function updateCredential(credId, data) {
  return prisma.userCredential.updateMany({ where: { credId }, data });
}

async function deleteCredential(credId) {
  return prisma.userCredential.deleteMany({ where: { credId } });
}

module.exports = {
  createUser,
  authenticateUser,
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUserByEmail,
  deleteUserByEmail,
  createCredential,
  getCredential,
  updateCredential,
  deleteCredential,
};
