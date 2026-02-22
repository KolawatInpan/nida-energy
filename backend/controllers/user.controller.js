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

module.exports = { 
	getUsers, 
	getUser, 
	getUserByBuildingName
};

