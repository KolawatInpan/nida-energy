const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

function signToken(payload) {
	const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret';
	return jwt.sign(payload, secret, { expiresIn: '30d' });
}

async function register(req, res) {
	try {
		const { name, email, password, role, telNum } = req.body || {};
		const user = await User.createUser(name, email, password, role, telNum);
		const token = signToken({ user });
		res.status(201).json({ user, token });
	} catch (err) {
		console.error('register error', err);
		res.status(err.status || 500).json({ error: err.message });
	}
}

async function login(req, res) {
	try {
		const { email, password } = req.body || {};
		const user = await User.authenticateUser(email, password);
		if (!user) return res.status(401).json({ error: 'invalid credentials' });
		const token = signToken({ user });
		res.json({ user, token });
	} catch (err) {
		console.error('login error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getUsers(req, res) {
	try {
		const users = await User.getAllUsers();
		res.json(users);
	} catch (err) {
		console.error('getUsers error', err);
		res.status(500).json({ error: err.message });
	}
}

async function me(req, res) {
	try {
		if (!req.user || !req.user.email) return res.status(401).json({ error: 'not authenticated' });
		const u = await User.getUserByEmail(req.user.email);
		res.json(u || req.user);
	} catch (err) {
		console.error('me error', err);
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

async function updateUser(req, res) {
	try {
		const id = req.params.id;
		const data = req.body || {};
		let updated = null;
		if (id && id.includes('@')) {
			updated = await User.updateUserByEmail(id, data);
		} else {
			const u = await User.getUserById(id);
			if (!u) return res.status(404).json({ error: 'user not found' });
			updated = await User.updateUserByEmail(u.email, data);
		}
		res.json(updated);
	} catch (err) {
		console.error('updateUser error', err);
		res.status(500).json({ error: err.message });
	}
}

async function deleteUser(req, res) {
	try {
		const id = req.params.id;
		if (id && id.includes('@')) {
			await User.deleteUserByEmail(id);
		} else {
			const u = await User.getUserById(id);
			if (!u) return res.status(404).json({ error: 'user not found' });
			await User.deleteUserByEmail(u.email);
		}
		res.json({ success: true });
	} catch (err) {
		console.error('deleteUser error', err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = { register, login, getUsers, me, getUser, updateUser, deleteUser };

