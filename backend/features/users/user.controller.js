const jwt = require('jsonwebtoken');
const User = require('./user.service'); // business logic (bcrypt, validation)

const otpStore = new Map(); // เก็บ OTP ไว้ในหน่วยความจำชั่วคราว

// NOTE: no local mail transport here on purpose. A second nodemailer transport used
// to live here hardcoding service:'gmail', which meant OTP mail ignored SMTP_HOST and
// introduced a third From address. All outgoing mail now goes through utils/email.js.

function buildAuthUser(user) {
    return {
        _id: user.credId || user.id,
        credId: user.credId,
        userId: user.userId || null,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'approved',
        notifyEmail: user.notifyEmail !== false,
        buildingAssignments: user.buildingAssignments || [],
        credentials: user.credentials || [],
    };
}

async function getUsers(req, res) {
    try {
        const users = await User.getUsers();
        res.json(users);
    } catch (err) {
        console.error('getUsers error', err);
        res.status(500).json({ error: err.message });
    }
}

async function getUser(req, res) {
    try {
        const id = req.params.id;
        if (id && id.includes('@')) {
            // Shared-email model: an email no longer identifies one user.
            // Return an explicit error instead of silently answering with the
            // first match (which could be the wrong person).
            return res.status(400).json({
                error: 'Email does not identify a unique user — all users share the same email. Look up users by credId instead, or use GET /api/users to list everyone.',
            });
        }
        const u = await User.getUserById(id);
        if (!u) return res.status(404).json({ error: 'user not found' });
        res.json(u);
    } catch (err) {
        console.error('getUser error', err);
        res.status(500).json({ error: err.message });
    }
}

async function getUserByBuildingName(req, res) {
    try {
        const buildingName = req.params.buildingName;
        const user = await User.getUserByBuildingName(buildingName);
        if (!user) return res.status(404).json({ error: 'user not found' });
        res.json(user);
    } catch (err) {
        console.error('getUserByBuildingName error', err);
        res.status(500).json({ error: err.message });
    }
}

async function getUserByBuildingId(req, res) {
    try {
        const buildingId = parseInt(req.params.buildingId);
        const user = await User.getUserByBuildingId(buildingId);
        if (!user) return res.status(404).json({ error: 'user not found' });
        res.json(user);
    } catch (err) {
        console.error('getUserByBuildingId error', err);
        res.status(500).json({ error: err.message });
    }
}

// OTP entries are keyed by email + name because all users share one email —
// an email-only key let a second registration overwrite the first person's OTP
// within the 5-minute window.
function otpKey(email, name) {
    return `${String(email || '').trim().toLowerCase()}|${String(name || '').trim().toLowerCase()}`;
}

async function requestOtp(req, res) {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุใน 5 นาที
        otpStore.set(otpKey(email, name), { code, expiresAt });

        // Lazy require per project convention (AGENTS.md: avoid top-level circular requires)
        const { sendEmail } = require('../../utils/email');
        await sendEmail({
            to: email,
            fromName: 'NIDA Energy Trading',
            subject: 'รหัส OTP สำหรับยืนยันการสมัครสมาชิก',
            html: `<h2>ยืนยันการสมัครสมาชิก</h2><p>รหัส OTP ของคุณคือ: <b>${code}</b></p><p>รหัสนี้มีอายุการใช้งาน 5 นาที</p>`,
        });
        res.json({ message: 'OTP sent successfully' });
    } catch (err) {
        console.error('requestOtp error', err);
        res.status(500).json({ error: 'Failed to send OTP email' });
    }
}

async function register(req, res) {
    try {
        const { name, email, password, otp, building_name } = req.body;
        const bypassOtp = req.headers['x-admin-bypass-otp'] === 'true';

        // ตรวจสอบ OTP (skip if admin bypass)
        if (!bypassOtp) {
            // New entries are keyed by email + name; fall back to the legacy
            // email-only key so OTPs requested just before a deploy still verify.
            const key = otpKey(email, name);
            const storedOtp = otpStore.get(key) || otpStore.get(email);
            if (!storedOtp)
                return res.status(400).json({ error: 'OTP is required. Please request an OTP first.' });
            console.log('[OTP verify]', {
                email,
                name: name || '-',
                sent: storedOtp.code,
                received: String(otp).trim(),
                match: String(storedOtp.code) === String(otp).trim(),
            });
            if (String(storedOtp.code) !== String(otp).trim())
                return res.status(400).json({ error: 'Invalid OTP' });
            if (Date.now() > storedOtp.expiresAt) {
                otpStore.delete(key);
                return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
            }
            otpStore.delete(key);
        }

        console.log('Registering user', { name, email });
        const newUser = await User.registerUser(name, email, password);
        res.status(201).json(newUser);
    } catch (err) {
        console.error('register error', err);
        res.status(400).json({ error: err.message });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const user = await User.authenticateUser(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Rejected users cannot login; pending users can login but see pending status
        if (user.status === 'rejected') {
            return res
                .status(403)
                .json({ error: 'Your account has been rejected. Please contact admin.' });
        }

        const authUser = buildAuthUser(user);
        const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret';
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        const token = jwt.sign({ user: authUser }, secret, { expiresIn });

        res.json({
            message: 'Login successful',
            token,
            user: authUser,
            expiresIn,
        });
    } catch (err) {
        console.error('login error', err);
        res.status(500).json({ error: err.message });
    }
}

async function adminLogin(req, res) {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'password is required' });
        }

        const { ADMINS } = require('./seedAdmin');

        // Try all admin emails with given password
        let user = null;
        for (const admin of ADMINS) {
            const found = await User.authenticateUser(admin.email, password);
            if (found) {
                user = found;
                break;
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid admin password' });
        }

        if (user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not an admin account' });
        }

        const authUser = buildAuthUser(user);
        const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret';
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        const token = jwt.sign({ user: authUser }, secret, { expiresIn });

        res.json({
            message: 'Admin login successful',
            token,
            user: authUser,
            expiresIn,
        });
    } catch (err) {
        console.error('adminLogin error', err);
        res.status(500).json({ error: err.message });
    }
}

async function updateUser(req, res) {
    try {
        const updated = await User.updateUser(req.params.id, req.body || {});
        res.json(updated);
    } catch (err) {
        console.error('updateUser error', err);
        if (err.message === 'Invalid user id') {
            return res.status(400).json({ error: err.message });
        }
        if (err.message === 'User not found') {
            return res.status(404).json({ error: err.message });
        }
        if (err?.code === 'P2002') {
            const field = (err?.meta?.target || []).join(', ');
            return res.status(409).json({ error: `Duplicate: ${field || 'value'} already exists` });
        }
        res.status(500).json({ error: err.message });
    }
}

async function deleteUser(req, res) {
    try {
        await User.deleteUser(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('deleteUser error', err);
        if (err.message === 'Invalid user id') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 'P2003') {
            return res.status(409).json({ error: 'Cannot delete user with related records' });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: err.message });
    }
}

/**
 * Admin Quick Register: User + Building + 3 Meters + Wallet in one call.
 * Bypasses OTP — only for admin use.
 */
async function adminQuickRegister(req, res) {
    try {
        const { buildingName, email: bodyEmail, password, address, city, postalCode, mapUrl, phoneNumber, buildingRole } =
            req.body || {};
        // Use shared user email. Deliberately NOT falling back to GMAIL_USER — that is the
        // SMTP sending account, and using it here would silently make every user's address
        // the sender's personal mailbox.
        const email = bodyEmail || process.env.USER_EMAIL || 'nida_blockchain.user@nida.ac.th';
        if (!buildingName || !password) {
            return res.status(400).json({ error: 'buildingName and password are required' });
        }

        const { prisma } = require('../../utils/prisma');
        const { randomUUID } = require('crypto');

        // 1. Create User (email is shared — no uniqueness check)
        let newUser;
        try {
            newUser = await User.registerUser(buildingName, email, password);
            // Admin-created users are pre-approved
            if (newUser?.credId) {
                await User.updateUser(newUser.credId, { status: 'approved' }).catch(() => {});
            }
        } catch (err) {
            throw err;
        }
        if (phoneNumber && newUser?.credId) {
            await User.updateUser(newUser.credId, { telNum: phoneNumber }).catch(() => {});
        }

        // 2. Create or reuse Building
        let building = await prisma.building.findUnique({ where: { name: buildingName } });
        const isProducer = buildingRole === 'producer';
        const targetTradeMeterType = isProducer ? 'produce' : 'battery';

        if (!building) {
            // Building.id is an Int WITHOUT autoincrement — every insert has to
            // supply the next id explicitly, otherwise Prisma rejects the create
            // with "Argument `id` is missing" (same logic as building.model).
            const maxId = await prisma.building.aggregate({ _max: { id: true } });
            building = await prisma.building.create({
                data: {
                    id: (maxId._max.id || 0) + 1,
                    name: buildingName,
                    address: address || '',
                    province: city || '',
                    postal: postalCode || '',
                    mapURL: mapUrl || '',
                    tradeMode: 'AUTO_BATTERY_THRESHOLD',
                    tradeMeterType: targetTradeMeterType,
                    batterySellThreshold: 80,
                    solarSelfPercent: 80,
                    approvalStatus: 'approved',
                    status: 'ACTIVE',
                },
            });
        } else {
            const updates = {};
            if (building.tradeMeterType !== targetTradeMeterType) {
                updates.tradeMeterType = targetTradeMeterType;
            }
            if (Object.keys(updates).length > 0) {
                building = await prisma.building.update({
                    where: { name: buildingName },
                    data: updates,
                });
            }
        }

        // 3. Create BuildingAssignment (user ↔ building)
        const existingAssignment = await prisma.buildingAssignment.findUnique({
            where: { buildingId_userId: { buildingId: building.id, userId: newUser.credId } },
        });
        if (!existingAssignment) {
            await prisma.buildingAssignment.create({
                data: {
                    buildingId: building.id,
                    userId: newUser.credId,
                    role: 'owner',
                },
            });
        }

        // 4. Create Wallet (per building)
        const walletId = randomUUID();
        const existingWallet = await prisma.wallet.findUnique({
            where: { buildingId: building.id },
        });
        if (!existingWallet) {
            const largeBuildings = ['Ratchaphruek', 'Malai', 'Auditorium'];
            const isLarge = largeBuildings.includes(buildingName);
            const initialTokens = isLarge ? 4700 : 2000;
            await prisma.wallet.create({
                data: { id: walletId, buildingId: building.id, tokenBalance: initialTokens },
            });
        }

        // 5. Create meters based on building + mode
        const today = new Date().toISOString().split('T')[0];
        const prefix = buildingName.replace(/ /g, '').substring(0, 3).toUpperCase();
        const rand = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0');

        let meters;
        if (isProducer) {
            meters = [
                { snid: `${prefix}-PRD-${rand}`, type: 'producer', capacity: 30 },
                { snid: `${prefix}-CON-${rand}`, type: 'consumer', capacity: 0 },
            ];
        } else {
            meters = [{ snid: `${prefix}-CON-${rand}`, type: 'consumer', capacity: 0 }];
        }

        const createdMeters = [];
        for (const m of meters) {
            const exists = await prisma.meterInfo.findUnique({ where: { snid: m.snid } });
            if (!exists) {
                await prisma.meterInfo.create({
                    data: {
                        snid: m.snid,
                        buildingName,
                        type: m.type,
                        capacity: m.capacity,
                        value: 0,
                        kWH: 0,
                        approveStatus: 'approved',
                        dateInstalled: new Date(today),
                        dateSubmit: new Date(),
                        isAutoMock: true,
                    },
                });
                createdMeters.push(m.snid);
            }
        }

        res.status(201).json({
            message: 'Admin quick register complete',
            user: { credId: newUser.credId, email, name: buildingName },
            building: { id: building.id, name: buildingName, role: isProducer ? 'producer' : 'consumer' },
            meters: createdMeters.length ? createdMeters : meters.map((m) => m.snid),
        });
    } catch (err) {
        console.error('adminQuickRegister error', err);
        res.status(400).json({ error: err.message });
    }
}

/**
 * Check if a user exists in the database.
 */
async function checkUser(req, res) {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'email is required' });
        }

        const { getCurrentPrisma } = require('../../utils/prisma');
        const db = getCurrentPrisma();

        // Shared email — find all users with this email
        const users = await db.user.findMany({
            where: { email },
            select: { credId: true, name: true, role: true, email: true },
        });

        res.json({
            email,
            found: users.length > 0,
            users: users,
        });
    } catch (err) {
        console.error('checkUser error', err);
        res.status(500).json({ error: err.message });
    }
}

async function getUserBuildings(req, res) {
    try {
        const { credId } = req.params;
        const { prisma } = require('../../utils/prisma');
        const assignments = await prisma.buildingAssignment.findMany({
            where: { userId: credId },
            include: {
                building: {
                    include: {
                        assignedUsers: {
                            include: { user: { select: { credId: true, name: true, email: true, role: true } } },
                        },
                        wallet: { select: { id: true, tokenBalance: true } },
                    },
                },
            },
        });
        const buildings = assignments.map((a) => a.building);
        res.json(buildings);
    } catch (err) {
        console.error('getUserBuildings error', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    getUsers,
    getUser,
    getUserByBuildingName,
    getUserByBuildingId,
    getUserBuildings,
    requestOtp,
    register,
    login,
    adminLogin,
    adminQuickRegister,
    checkUser,
    updateUser,
    deleteUser,
    // User Approval
    async getPendingUsers(req, res) {
        try {
            res.json(await User.getPendingUsers());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async approveUser(req, res) {
        try {
            res.json(await User.approveUser(req.params.id));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async rejectUser(req, res) {
        try {
            res.json(await User.rejectUser(req.params.id));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
};
