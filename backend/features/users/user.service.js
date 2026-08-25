const bcrypt = require('bcrypt');
const repo = require('./user.repository');

async function registerUser(name, email, password) {
    if (!name || !email || !password) throw new Error('Name, email, and password are required');
    const existingUser = await repo.findUserByEmailRaw(email);
    if (existingUser) throw new Error('User with this email already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await repo.createUser({ name, email, hashedPassword });

    try {
        const { createNotification } = require('../notification/notification.service');
        await createNotification({ type: 'user_registered', message: `มีผู้ใช้ใหม่ลงทะเบียน: ${name} (${email})`, userId: null });
    } catch (e) { console.error('Notification error:', e.message); }

    return repo.sanitizeUser(newUser);
}

async function authenticateUser(email, password) {
    if (!email || !password) throw new Error('Email and password are required');
    const user = await repo.findUserByEmailRaw(email);
    if (!user || !user.passwordHash) return null;
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) return null;
    return repo.sanitizeUser(user);
}

async function updateUserWithValidation(credId, updates = {}) {
    if (!credId || String(credId).trim() === '') throw new Error('Invalid user id');
    const existing = await repo.getUserById(credId);
    if (!existing) throw new Error('User not found');
    const data = {};
    if (updates.name !== undefined) data.name = String(updates.name || '').trim() || existing.name;
    if (updates.telNum !== undefined) data.telNum = String(updates.telNum || '').trim() || null;
    if (updates.role !== undefined) {
        const nr = String(updates.role || '').trim().toUpperCase();
        if (['USER', 'ADMIN'].includes(nr)) data.role = nr;
    }
    if (updates.status !== undefined) data.status = String(updates.status || 'pending');
    if (updates.userId !== undefined) data.userId = updates.userId === null ? null : Number(updates.userId);
    // ── Notification preferences ──
    if (updates.telegramChatId !== undefined) {
        data.telegramChatId = updates.telegramChatId === null || String(updates.telegramChatId).trim() === ''
            ? null : String(updates.telegramChatId).trim();
    }
    if (updates.notifyEmail !== undefined) data.notifyEmail = Boolean(updates.notifyEmail);
    if (updates.notifyTelegram !== undefined) data.notifyTelegram = Boolean(updates.notifyTelegram);
    if (updates.notifyTypes !== undefined) {
      const raw = Array.isArray(updates.notifyTypes) ? updates.notifyTypes : [];
      data.notifyTypes = raw.map(t => String(t)).filter(Boolean);
    }
    // ── Email change (special handling — email is the user PK) ──
    if (updates.email !== undefined && String(updates.email || '').trim() !== existing.email) {
        const newEmail = String(updates.email || '').trim().toLowerCase();
        if (!newEmail) throw new Error('Email is required');
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(newEmail)) throw new Error('Invalid email format');
        const updatedUser = await repo.updateUserEmail(credId, newEmail);
        return repo.sanitizeUser(updatedUser);
    }
    const updated = await repo.updateUser(credId, data);
    return repo.sanitizeUser(updated);
}

module.exports = { ...repo, registerUser, authenticateUser, updateUser: updateUserWithValidation };
