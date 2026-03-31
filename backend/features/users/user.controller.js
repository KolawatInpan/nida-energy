const jwt = require('jsonwebtoken');
const User = require('./user.model');

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

async function register(req, res) {
	try {
		const { name, email, password } = req.body;
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

module.exports = { 
	getUsers, 
	getUser, 
	getUserByBuildingName,
	getUserByBuildingId,
	register,
	login,
	updateUser,
	deleteUser
};



