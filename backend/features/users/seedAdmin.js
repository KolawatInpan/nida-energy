const { prisma } = require('../../utils/prisma');
const bcrypt = require('bcrypt');

const DEFAULT_ADMIN_EMAIL = 'admin@nida.ac.th';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const ADMINS = [
    { name: 'System Administrator', email: 'admin@nida.ac.th', password: 'admin123' },
    { name: 'Energy Manager', email: 'energy-admin@nida.ac.th', password: 'admin456' },
];

/**
 * Seed admin users on startup.
 * Creates both admin accounts if not exists.
 */
async function seedDefaultAdmin() {
    try {
        for (const admin of ADMINS) {
            const existing = await prisma.user.findUnique({ where: { email: admin.email } });
            if (existing) {
                if (existing.role !== 'ADMIN') {
                    await prisma.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } });
                    console.log('[SEED] Updated', admin.email, 'role to ADMIN');
                } else {
                    console.log('[SEED] Admin already exists:', admin.email);
                }
                continue;
            }

            const passwordHash = await bcrypt.hash(admin.password, 10);
            const { randomUUID } = require('crypto');
            const credId = randomUUID();

            await prisma.user.create({
                data: {
                    credId,
                    name: admin.name,
                    email: admin.email,
                    passwordHash,
                    role: 'ADMIN',
                },
            });
            console.log('[SEED] Admin created:', admin.email);
        }
    } catch (err) {
        console.warn('[SEED] seedDefaultAdmin failed:', err?.message || err);
        return null;
    }
}

module.exports = { seedDefaultAdmin, ADMINS, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD };
