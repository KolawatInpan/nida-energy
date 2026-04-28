const { prisma } = require('../../utils/prisma');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

async function getUsers() {
  const users = await prisma.user.findMany({ include: { credentials: true, wallets: true } });
  return users.map(sanitizeUser);
}

async function getUserByBuildingName(buildingName) {
  if (!buildingName || String(buildingName).trim() === '') return null;
  // get User from email from building (await the DB call)
  const building = await prisma.building.findUnique({ where: { name: buildingName }, select: { email: true } });
  const buildingEmail = building?.email;
  if (!buildingEmail) return null;
  const user = await prisma.user.findUnique({ where: { email: buildingEmail }, include: { wallets: true, credentials: true } });
  return sanitizeUser(user);
}

async function getUserById(credId) {
  if (!credId || String(credId).trim() === '') return null;
  const user = await prisma.user.findUnique({ where: { credId }, include: { wallets: true, credentials: true } });
  return sanitizeUser(user);
}

async function getUserByEmail(email) {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, include: { wallets: true, credentials: true } });
  return sanitizeUser(user);
}

async function getUserByBuildingId(buildingId) {
  if (!buildingId) return null;
  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { email: true } });
  const buildingEmail = building?.email;
  if (!buildingEmail) return null;
  const user = await prisma.user.findUnique({ where: { email: buildingEmail }, include: { wallets: true, credentials: true } });
  return sanitizeUser(user);
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
      credId,
      role: 'USER',
    },
    include: { credentials: true, wallets: true },
  });
  // สร้าง notification สำหรับ admin
  try {
    const { createNotification } = require('../notification/notification.service');
    await createNotification({
      type: 'user_registered',
      message: `มีผู้ใช้ใหม่ลงทะเบียน: ${name} (${email})`,
      userId: null
    });
  } catch (e) { console.error('Notification error:', e.message); }
  return sanitizeUser(newUser);
}

async function authenticateUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { credentials: true, wallets: true },
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return sanitizeUser(user);
}

async function updateUser(credId, updates = {}) {
  if (!credId || String(credId).trim() === '') {
    throw new Error('Invalid user id');
  }

  const existing = await prisma.user.findUnique({
    where: { credId: String(credId) },
    include: { credentials: true, wallets: true },
  });

  if (!existing) {
    throw new Error('User not found');
  }

  const data = {};
  if (updates.name !== undefined) data.name = String(updates.name || '').trim() || existing.name;
  if (updates.telNum !== undefined) data.telNum = String(updates.telNum || '').trim() || null;
  if (updates.role !== undefined) {
    const normalizedRole = String(updates.role || '').trim().toUpperCase();
    if (['USER', 'ADMIN'].includes(normalizedRole)) {
      data.role = normalizedRole;
    }
  }

  const updated = await prisma.user.update({
    where: { credId: String(credId) },
    data,
    include: { credentials: true, wallets: true },
  });

  return sanitizeUser(updated);
}

async function deleteUser(credId) {
  if (!credId || String(credId).trim() === '') {
    throw new Error('Invalid user id');
  }

  return prisma.$transaction(async (tx) => {
    await tx.userCredential.deleteMany({
      where: { credId: String(credId) },
    });

    return tx.user.delete({
      where: { credId: String(credId) },
    });
  });
}

module.exports = {
  getUsers,
  getUserById,
  getUserByEmail,
  getUserByBuildingName,
  getUserByBuildingId,
  registerUser,
  authenticateUser,
  updateUser,
  deleteUser,
};


