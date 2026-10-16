const bcrypt = require('bcrypt');
const repo = require('./user.repository');

async function registerUser(name, email, password) {
    if (!name || !email || !password) throw new Error('Name, email, and password are required');
    // Note: email is now SHARED — multiple users can have the same email
    // No uniqueness check needed on email.

    // Identity guard: login matches by email + password, so a duplicate name would
    // let the login loop match whichever user comes first — silently hijacking the
    // account. Reject the name globally (any email, any role) before creating the user.
    const normalizedName = String(name).trim().toLowerCase();
    const { getCurrentPrisma } = require('../../utils/prisma');
    const db = getCurrentPrisma();
    const sameName = await db.user.findMany({
        where: { name: { equals: normalizedName, mode: 'insensitive' } },
        select: { credId: true },
    });
    if (sameName.length > 0) {
        const err = new Error(`User name "${String(name).trim()}" already exists. Names must be unique because login identifies users by name + password.`);
        err.status = 409;
        throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await repo.createUser({ name, email, hashedPassword });

    try {
        const { createNotification } = require('../notification/notification.service');
        await createNotification({
            type: 'user_registered',
            message: `มีผู้ใช้ใหม่ลงทะเบียน: ${name} (${email})`,
            userId: null,
        });
    } catch (e) {
        console.error('Notification error:', e.message);
    }

    return repo.sanitizeUser(newUser);
}

/**
 * Authenticate user with shared email + password.
 * Since all users share the same email, we look up ALL users with that email
 * and bcrypt.compare password against each one.
 *
 * @param {string} email - shared email (same for all users)
 * @param {string} password - plaintext password
 * @returns {object|null} first matching user or null
 */
async function authenticateUser(email, password) {
    if (!email || !password) throw new Error('Email and password are required');

    // Find ALL users with this email (shared email model)
    const users = await repo.findUsersByEmailRaw(email);
    if (!users || users.length === 0) return null;

    // Try bcrypt.compare against each user's password
    for (const user of users) {
        if (!user.passwordHash) continue;
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (passwordMatches) {
            return repo.sanitizeUser(user);
        }
    }

    return null; // No matching password found
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
    if (updates.notifyEmail !== undefined) data.notifyEmail = Boolean(updates.notifyEmail);
    if (updates.notifyTypes !== undefined) {
        const raw = Array.isArray(updates.notifyTypes) ? updates.notifyTypes : [];
        data.notifyTypes = raw.map((t) => String(t)).filter(Boolean);
    }

    // ── Email is shared and must stay the system-wide shared address ──
    // Changing one user's email would move their OTP/notifications to an inbox
    // outside the shared-email model. Email is set at creation time only.
    if (updates.email !== undefined) {
        const requested = String(updates.email || '').trim().toLowerCase();
        if (requested && requested !== String(existing.email || '').trim().toLowerCase()) {
            const err = new Error('Email cannot be changed — the system uses shared emails (User Email / Admin Email). Contact an administrator if this address is wrong.');
            err.status = 400;
            throw err;
        }
        // Same value → no-op, allow silently
    }

    const updated = await repo.updateUser(credId, data);
    return repo.sanitizeUser(updated);
}

module.exports = {
    ...repo,
    registerUser,
    authenticateUser,
    updateUser: updateUserWithValidation,
};
