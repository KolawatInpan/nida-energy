const jwt = require('jsonwebtoken');
const User = require('./user.service');  // business logic (bcrypt, validation)
const nodemailer = require('nodemailer');

const otpStore = new Map(); // เก็บ OTP ไว้ในหน่วยความจำชั่วคราว

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.GMAIL_USER || 'your-email@gmail.com',
		pass: process.env.GMAIL_PASS || 'your-pass'
	}
});

function buildAuthUser(user) {
	return {
		_id: user.credId || user.id || user.email,
		id: user.id,
		credId: user.credId,
		name: user.name,
		email: user.email,
		role: user.role,
		wallets: user.wallets || [],
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
		let u = null;
		if (id && id.includes('@')) u = await User.getUserByEmail(id);
		else u = await User.getUserById(id);
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

async function requestOtp(req, res) {
	try {
		const { email } = req.body;
		if (!email) return res.status(400).json({ error: 'Email is required' });

		const code = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุใน 5 นาที
		otpStore.set(email, { code, expiresAt });

		await transporter.sendMail({
			from: `"NIDA Energy Trading" <${process.env.GMAIL_USER || 'no-reply@nida.ac.th'}>`,
			to: email,
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
		const { name, email, password, otp } = req.body;
		
		// ตรวจสอบ OTP
		const storedOtp = otpStore.get(email);
		if (!storedOtp) return res.status(400).json({ error: 'OTP is required. Please request an OTP first.' });
		console.log('[OTP verify]', { email, sent: storedOtp.code, received: String(otp).trim(), match: String(storedOtp.code) === String(otp).trim() });
		if (String(storedOtp.code) !== String(otp).trim()) return res.status(400).json({ error: 'Invalid OTP' });
		if (Date.now() > storedOtp.expiresAt) {
			otpStore.delete(email);
			return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
		}
		
		otpStore.delete(email); // ยืนยันสำเร็จ ลบ OTP ทิ้ง

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
		const { buildingName, email, password, address, city, postalCode, mapUrl, phoneNumber, buildingRole } = req.body || {};
		if (!buildingName || !email || !password) {
			return res.status(400).json({ error: 'buildingName, email, and password are required' });
		}

		// buildingRole: 'producer' = Ratchaphruek/Malai (has producer meters)
		// Auditorium is mode-dependent: real=consumer only, demo=producer
		// Others: consumer only
		const { realPrisma, demoPrisma, getCurrentMode, REAL_MODE } = require('../../utils/prisma');
		const isRealMode = getCurrentMode() === REAL_MODE;
		const isRatchaphruek = buildingName === 'Ratchaphruek';
		const isAuditorium = buildingName === 'Auditorium';

		// Auditorium: producer in demo, consumer in real
		const isProducer = isAuditorium
			? !isRealMode  // demo mode = producer, real mode = consumer
			: buildingRole === 'producer';

		// 1. Create or reuse User
		let newUser;
		try {
			newUser = await User.registerUser(buildingName, email, password);
		} catch (err) {
			if (err.message === 'User with this email already exists') {
				newUser = await User.getUserByEmail(email);
				console.log('[adminQuickRegister] User already exists, reusing:', email);
			} else {
				throw err;
			}
		}
		if (phoneNumber) {
			await User.updateUser(email, { telNum: phoneNumber }).catch(() => {});
		}

		// 2. Create or reuse Building
		const { prisma } = require('../../utils/prisma');
		const { randomUUID } = require('crypto');
		let building = await prisma.building.findUnique({ where: { name: buildingName } });
		// tradeMeterType: 'produce' for producers, 'battery' for consumers
		const targetTradeMeterType = isProducer ? 'produce' : 'battery';
		if (!building) {
			building = await prisma.building.create({
				data: {
					name: buildingName,
					email,
					address: address || '',
					province: city || '',
					postal: postalCode || '',
					mapURL: mapUrl || '',
					tradeMode: 'AUTO_BATTERY_THRESHOLD',
					tradeMeterType: targetTradeMeterType,
					batterySellThreshold: 80,
					solarSelfPercent: 80,
				},
			});
		} else {
			// Update building if email or tradeMeterType changed
			const updates = {};
			if (building.email !== email) updates.email = email;
			if (building.tradeMeterType !== targetTradeMeterType) updates.tradeMeterType = targetTradeMeterType;

			if (Object.keys(updates).length > 0) {
				building = await prisma.building.update({
					where: { name: buildingName },
					data: updates,
				});
				console.log('[adminQuickRegister] Building updated:', buildingName, updates);
			} else {
				console.log('[adminQuickRegister] Building already exists, reusing:', buildingName);
			}
		}

		// 3. Create Wallet with initial tokens = estimated monthly consumption
		const largeBuildings = ['Ratchaphruek', 'Malai', 'Auditorium'];
		const isLarge = largeBuildings.includes(buildingName);
		// Large: ~6.5 kW avg × 24h × 30d ≈ 4,700 kWh/mo → 4,700 tokens
		// Small: ~2.75 kW avg × 24h × 30d ≈ 2,000 kWh/mo → 2,000 tokens
		const initialTokens = isLarge ? 4700 : 2000;

		const walletId = randomUUID();
		const dbsToCreate = isRealMode ? [realPrisma, demoPrisma] : [demoPrisma];
		for (const db of dbsToCreate) {
			const exists = await db.wallet.findUnique({ where: { email } }).catch(() => null);
			if (!exists) {
				await db.wallet.create({
					data: { id: walletId, email, tokenBalance: initialTokens },
				}).catch(err => console.warn('[adminQuickRegister] Wallet create failed for', email, err.message));
			}
		}

		// 4. Create meters based on building + mode
		// Ratchaphruek: produce + battery + consume (3 meters, both modes)
		// Malai: produce + consume (2 meters)
		// Auditorium: produce + consume in demo, consume only in real
		// Others (consumer buildings): consume only (1 meter)
		const today = new Date().toISOString().split('T')[0];
		const prefix = buildingName.replace(/ /g, '').substring(0, 3).toUpperCase();
		const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

		let meters;
		if (isRatchaphruek) {
			// Ratchaphruek: producer 5kW + battery 20kWh + consumer
			meters = [
				{ snid: `${prefix}-PRD-${rand}`, type: 'producer', capacity: 5 },
				{ snid: `${prefix}-BAT-${rand}`, type: 'battery', capacity: 20 },
				{ snid: `${prefix}-CON-${rand}`, type: 'consumer', capacity: 0 },
			];
		} else if (isProducer) {
			// Malai: 30kW, Auditorium (demo): 3kW
			const producerCapacity = isAuditorium ? 3 : 30;
			meters = [
				{ snid: `${prefix}-PRD-${rand}`, type: 'producer', capacity: producerCapacity },
				{ snid: `${prefix}-CON-${rand}`, type: 'consumer', capacity: 0 },
			];
		} else {
			// Auditorium (real mode) / other consumers: consume only
			meters = [
				{ snid: `${prefix}-CON-${rand}`, type: 'consumer', capacity: 0 },
			];
		}

		// Remove old meters not in the new config (to handle role changes)
		const keepTypes = meters.map(m => m.type);
		const removeTypes = ['producer', 'battery', 'consumer'].filter(t => !keepTypes.includes(t));
		if (removeTypes.length > 0) {
			await prisma.meterInfo.deleteMany({
				where: { buildingName, type: { in: removeTypes } },
			}).catch(() => {});
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
			user: { email, name: buildingName },
			building: { id: building.id, name: buildingName, role: isProducer ? 'producer' : 'consumer' },
			meters: createdMeters.length ? createdMeters : meters.map(m => m.snid),
		});
	} catch (err) {
		console.error('adminQuickRegister error', err);
		res.status(400).json({ error: err.message });
	}
}

/**
 * Check if a user exists in real DB, demo DB, or both.
 * Bypasses AsyncLocalStorage — queries both Prisma clients directly.
 */
async function checkUser(req, res) {
	try {
		const { email } = req.body || {};
		if (!email) {
			return res.status(400).json({ error: 'email is required' });
		}

		const { realPrisma, demoPrisma } = require('../../utils/prisma');

		const [realUser, demoUser] = await Promise.all([
			realPrisma.user.findUnique({ where: { email }, select: { email: true, name: true, role: true } }).catch(() => null),
			demoPrisma.user.findUnique({ where: { email }, select: { email: true, name: true, role: true } }).catch(() => null),
		]);

		res.json({
			email,
			real: realUser ? { name: realUser.name, role: realUser.role } : null,
			demo: demoUser ? { name: demoUser.name, role: demoUser.role } : null,
		});
	} catch (err) {
		console.error('checkUser error', err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = { 
	getUsers, 
	getUser, 
	getUserByBuildingName,
	getUserByBuildingId,
	requestOtp,
	register,
	login,
	adminLogin,
	adminQuickRegister,
	checkUser,
	updateUser,
	deleteUser
};
