const { prisma, realPrisma, demoPrisma } = require('../../utils/prisma');
const bcrypt = require('bcrypt');

const DEFAULT_ADMIN_EMAIL = 'admin@nida.ac.th';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const ADMINS = [
    { name: 'System Administrator', email: 'admin@nida.ac.th', password: 'admin123' },
    { name: 'Energy Manager', email: 'energy-admin@nida.ac.th', password: 'admin456' },
];

async function seedAdminToDb(db, label) {
    for (const admin of ADMINS) {
        const existing = await db.user.findUnique({ where: { email: admin.email } });
        if (existing) {
            if (existing.role !== 'ADMIN') {
                await db.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } });
                console.log(`[SEED] ${label} Updated ${admin.email} role to ADMIN`);
            } else {
                console.log(`[SEED] ${label} Admin exists: ${admin.email}`);
            }
            continue;
        }

        const passwordHash = await bcrypt.hash(admin.password, 10);
        const credId = require('crypto').randomUUID();

        const maxSeq = await db.user.aggregate({ _max: { userId: true } });
        const seqId = (maxSeq._max.userId || 0) + 1;
        await db.user.create({
            data: { credId, userId: seqId, name: admin.name, email: admin.email, passwordHash, role: 'ADMIN' },
        });
        console.log(`[SEED] ${label} Admin created: ${admin.email}`);
    }

    // Shared admin treasury wallet — all admins use this one wallet
    const ADMIN_WALLET_EMAIL = 'admin@nida.ac.th';
    const wallet = await db.wallet.findUnique({ where: { email: ADMIN_WALLET_EMAIL } });
    if (!wallet) {
        const { randomUUID } = require('crypto');
        await db.wallet.create({ data: { id: randomUUID(), email: ADMIN_WALLET_EMAIL, tokenBalance: 0 } });
        console.log(`[SEED] ${label} Shared admin wallet created: ${ADMIN_WALLET_EMAIL}`);
    }
}

/**
 * Seed admin users on startup into BOTH real and demo databases.
 */
async function seedDefaultAdmin() {
    try {
        await seedAdminToDb(realPrisma, 'REAL');
        await seedAdminToDb(demoPrisma, 'DEMO');
    } catch (err) {
        console.warn('[SEED] seedDefaultAdmin failed:', err?.message || err);
    }
}

module.exports = { seedDefaultAdmin, ADMINS, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD };
