const RunningMeter = require('./runningMeter.model');
const energyAggregation = require('./energyAggregation');

async function createRunningEntry(req, res) {
	try {
		const { snid, timestamp, kW, kWH, txid } = req.body;
		if (!snid || !timestamp) return res.status(400).json({ error: 'snid and timestamp are required' });
		const entry = await RunningMeter.createRunningEntry(snid, timestamp, kW, kWH, txid);
		res.json(entry);
	} catch (err) {
		console.error('createRunningEntry error', err);
		res.status(500).json({ error: err.message });
	}
}

async function generateHourlyEntries(req, res) {
	try {
		const { snid, start, end, intervalHours, valueProfile, profileParams, startingKwh } = req.body;
		if (!snid || !start || !end) return res.status(400).json({ error: 'snid, start, and end are required' });
		const options = { intervalHours, valueProfile, profileParams, startingKwh };
		const result = await RunningMeter.generateHourlyEntries(snid, start, end, options);
		res.json(result);
	} catch (err) {
		console.error('generateHourlyEntries error', err);
		res.status(500).json({ error: err.message });
	}
}

async function insertRunningLog(req, res) {
	try {
		const { snid, timestamp, kW, kWH, txid } = req.body;
		if (!snid || !timestamp) return res.status(400).json({ error: 'snid and timestamp are required' });
		const created = await energyAggregation.insertRunningMeter({ snid, timestamp, kW, kWH, txid });
		res.json(created);
	} catch (err) {
		console.error('insertRunningLog error', err);
		res.status(500).json({ error: err.message });
	}
}

async function insertRunningLogsBulk(req, res) {
	try {
		const { logs } = req.body;
		if (!Array.isArray(logs) || logs.length === 0) {
			return res.status(400).json({ error: 'logs array is required' });
		}
		const result = await energyAggregation.insertRunningMetersBulk(logs);
		res.json(result);
	} catch (err) {
		console.error('insertRunningLogsBulk error', err);
		res.status(500).json({ error: err.message });
	}
}

async function resetEnergyLogs(req, res) {
	try {
		const result = await energyAggregation.resetEnergyLogs();
		res.json({ success: true, cleared: result });
	} catch (err) {
		console.error('resetEnergyLogs error', err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = {
	createRunningEntry,
	generateHourlyEntries,
	insertRunningLog,
	insertRunningLogsBulk,
	resetEnergyLogs,
};
