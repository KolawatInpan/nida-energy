const { prisma } = require('../../utils/prisma');

const RATE_TABLE_NAME = '"ElectricityRateRule"';

function sanitizeNotification(row) {
	return {
		id: row.id,
		email: row.email,
		title: row.title,
		body: row.body,
		data: row.data,
		read: row.read,
		createdAt: row.createdAt,
	};
}

async function createNotification(req, res) {
	try {
		const { email, title, body, data, read } = req.body || {};

		if (!email || !title || !body) {
			return res.status(400).json({ error: 'email, title and body are required' });
		}

		const created = await prisma.notification.create({
			data: {
				email: String(email),
				title: String(title),
				body: String(body),
				data: data ?? undefined,
				read: Boolean(read),
			},
		});

		return res.status(201).json(sanitizeNotification(created));
	} catch (error) {
		console.error('createNotification error:', error);
		return res.status(500).json({ error: error.message });
	}
}

async function listNotifications(req, res) {
	try {
		const notifications = await prisma.notification.findMany({
			orderBy: { createdAt: 'desc' },
		});

		return res.json(notifications.map(sanitizeNotification));
	} catch (error) {
		console.error('listNotifications error:', error);
		return res.status(500).json({ error: error.message });
	}
}

async function deleteNotification(req, res) {
	try {
		const notificationId = Number(req.params.id);
		if (!Number.isFinite(notificationId)) {
			return res.status(400).json({ error: 'Invalid notification id' });
		}

		await prisma.notification.delete({ where: { id: notificationId } });
		return res.json({ success: true });
	} catch (error) {
		console.error('deleteNotification error:', error);
		return res.status(500).json({ error: error.message });
	}
}

async function logActivity(req, res) {
	try {
		const { email, activitytype, detail } = req.body || {};

		if (!email || !activitytype) {
			return res.status(400).json({ error: 'email and activitytype are required' });
		}

		const created = await prisma.activityLog.create({
			data: {
				email: String(email),
				activitytype: String(activitytype),
				detail: detail ?? {},
			},
		});

		return res.status(201).json(created);
	} catch (error) {
		console.error('logActivity error:', error);
		return res.status(500).json({ error: error.message });
	}
}

async function resetDatabase(req, res) {
	try {
		const preserveAdmins = req.body?.preserveAdmins !== false;
		const adminUsers = preserveAdmins
			? await prisma.user.findMany({
				where: { role: 'ADMIN' },
				select: { email: true, credId: true, name: true },
			})
			: [];

		const preservedEmails = adminUsers.map((user) => user.email);
		const preservedCredIds = adminUsers.map((user) => user.credId);
		const deleted = {};

		const removeAll = async (modelName, args) => {
			const result = await prisma[modelName].deleteMany(args);
			deleted[modelName] = result.count || 0;
		};

		await removeAll('blockTransaction');
		await removeAll('receipt');
		await removeAll('transaction');
		await removeAll('walletTx');
		await removeAll('invoice');
		await removeAll('energyOffer');
		await removeAll('runningMeter');
		await removeAll('hourlyEnergy');
		await removeAll('dailyEnergy');
		await removeAll('weeklyEnergy');
		await removeAll('monthlyEnergy');
		await removeAll('notification');
		await removeAll('activityLog');
		await removeAll('battery');
		await removeAll('meterInfo');
		await removeAll('wallet');
		await removeAll('building');

		if (preserveAdmins && preservedCredIds.length > 0) {
			await removeAll('userCredential', { where: { credId: { notIn: preservedCredIds } } });
		} else {
			await removeAll('userCredential');
		}

		if (preserveAdmins && preservedEmails.length > 0) {
			await removeAll('user', { where: { email: { notIn: preservedEmails } } });
		} else {
			await removeAll('user');
		}

		try {
			const rateDeleteResult = await prisma.$executeRawUnsafe(`DELETE FROM ${RATE_TABLE_NAME}`);
			deleted.rateRules = Number(rateDeleteResult || 0);
		} catch (rateError) {
			deleted.rateRules = 0;
			console.warn('resetDatabase rate table cleanup skipped:', rateError?.message || rateError);
		}

		return res.json({
			success: true,
			message: preserveAdmins
				? 'Database reset completed. Admin accounts were preserved.'
				: 'Database reset completed.',
			preserveAdmins,
			preservedAdmins: adminUsers.map((user) => ({ email: user.email, name: user.name })),
			deleted,
		});
	} catch (error) {
		console.error('resetDatabase error:', error);
		return res.status(500).json({ error: error.message });
	}
}

module.exports = {
	createNotification,
	listNotifications,
	deleteNotification,
	logActivity,
	resetDatabase,
};
