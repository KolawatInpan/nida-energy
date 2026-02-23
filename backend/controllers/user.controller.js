const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

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

module.exports = { 
	getUsers, 
	getUser, 
	getUserByBuildingName,
	getUserByBuildingId,
	register
};

