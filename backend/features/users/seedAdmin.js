const { prisma, realPrisma, demoPrisma } = require('../../utils/prisma');
const bcrypt = require('bcrypt');

// Single source of truth for the seeded system admins.
// All admins SHARE the same address (email is not unique) and are told apart by name + password.
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'blockchain.admin@nida.ac.th';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nidaadmin1';

const ADMINS = [
    { name: 'System Administrator', email: DEFAULT_ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD || 'nidaadmin1' },
    { name: 'Energy Manager', email: DEFAULT_ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD_2 || 'nidaadmin2' },
];

async function seedAdminToDb(db, label) {
    for (const admin of ADMINS) {
        // Shared email model: check by name + role (email is shared across users)
        const existing = await db.user.findFirst({
            where: { name: admin.name, role: 'ADMIN' },
        });
        if (existing) {
            // ADMINS is the source of truth, and adminLogin() looks users up by these very
            // addresses. If ADMIN_EMAIL changed, repair the stale row instead of leaving an
            // admin that can no longer sign in.
            if (admin.email && existing.email !== admin.email) {
                await db.user.update({
                    where: { credId: existing.credId },
                    data: { email: admin.email },
                });
                console.log(`[SEED] ${label} Admin email updated: ${admin.name} (${existing.email} -> ${admin.email})`);
            } else {
                console.log(`[SEED] ${label} Admin exists: ${admin.name}`);
            }
            continue;
        }

        // Create new admin user (shared email is fine — each user has unique password)
        const passwordHash = await bcrypt.hash(admin.password, 10);
        const credId = require('crypto').randomUUID();
        const maxSeq = await db.user.aggregate({ _max: { userId: true } });
        const seqId = (maxSeq._max.userId || 0) + 1;
        await db.user.create({
            data: {
                credId,
                userId: seqId,
                name: admin.name,
                email: admin.email,
                passwordHash,
                role: 'ADMIN',
                status: 'approved',
            },
        });
        console.log(`[SEED] ${label} Admin created: ${admin.name} (${admin.email})`);
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
