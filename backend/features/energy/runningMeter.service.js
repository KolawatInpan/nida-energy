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
		// Validate SNIDs exist before inserting
		const snids = [...new Set(logs.map(l => l.snid).filter(Boolean))];
		if (snids.length === 0) {
			return res.status(400).json({ error: 'No valid snid in logs' });
		}
		const result = await energyAggregation.insertRunningMetersBulk(logs);
		res.json(result);
	} catch (err) {
		console.error('insertRunningLogsBulk error', err?.message || err);
		// Return partial success instead of 500
		res.status(500).json({ error: err?.message || 'Internal server error', count: 0, inserted: 0 });
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
	getStatus: async (req, res) => {
 		try {
 			const { prisma } = require('../../utils/prisma');
 			const cronSchedule = process.env.MOCK_ENERGY_CRON || null;
 			const currentTime = new Date();

 			// Count active auto-mock meters
 			const activeAutoMeters = await prisma.meterInfo.count({ where: { isAutoMock: true } });

 			let lastSent = null;
 			if (activeAutoMeters > 0) {
 				const activeList = await prisma.meterInfo.findMany({ where: { isAutoMock: true }, select: { snid: true } });
 				const snids = activeList.map(m => m.snid);
 				const lastRow = await prisma.runningMeter.findFirst({ where: { snid: { in: snids } }, orderBy: { timestamp: 'desc' } });
 				lastSent = lastRow?.timestamp || null;
 			} else {
 				const lastRow = await prisma.runningMeter.findFirst({ orderBy: { timestamp: 'desc' } });
 				lastSent = lastRow?.timestamp || null;
 			}

 			res.json({ cronSchedule, activeAutoMeters, currentTime: currentTime.toISOString(), lastSent: lastSent ? new Date(lastSent).toISOString() : null });
 		} catch (err) {
 			console.error('getStatus error', err);
 			res.status(500).json({ error: err.message });
 		}
 	}
	,
	backfill: async (req, res) => {
		try {
			const { start, end, delayMs } = req.body || {};
			if (!start) return res.status(400).json({ error: 'start is required (ISO string)' });
			// spawn a detached node process to run the script so HTTP request returns immediately
			const scriptPath = require('path').resolve(__dirname, '../../tools/backfillMock.js');
			const node = require('child_process').spawn(process.execPath, [scriptPath, `--start=${start}`].concat(end ? [`--end=${end}`] : []).concat(delayMs ? [`--delayMs=${delayMs}`] : []), {
				detached: true,
				stdio: 'ignore'
			});
			node.unref();
			return res.json({ started: true, pid: node.pid });
		} catch (err) {
			console.error('backfill API error', err);
			res.status(500).json({ error: err.message });
		}
	}
	,
	backfillStatus: async (req, res) => {
		try {
			const pid = req.query.pid;
			const fs = require('fs');
			const path = require('path');
			const tmpDir = path.resolve(__dirname, '../../tmp');
			if (!fs.existsSync(tmpDir)) return res.status(404).json({ error: 'No backfill status available' });
			if (pid) {
				const file = path.join(tmpDir, `backfill-status-${pid}.json`);
				if (!fs.existsSync(file)) return res.status(404).json({ error: 'No status for pid' });
				try {
					const raw = fs.readFileSync(file, 'utf8');
					if (!raw || raw.trim().length === 0) return res.status(202).json({ status: null, note: 'status file empty' });
					const data = JSON.parse(raw);
					return res.json({ status: data });
				} catch (parseErr) {
					console.error('backfillStatus parse error for pid', pid, parseErr.message);
					// file may be incomplete while backfill is writing; return accepted with partial info
					const raw = fs.readFileSync(file, 'utf8');
					return res.status(202).json({ status: null, note: 'status file incomplete', raw: raw.slice(0, 2000) });
				}
			}
			// return most recent status file
			const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('backfill-status-') && f.endsWith('.json'))
				.map(f => ({ f, mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs }))
				.sort((a,b) => b.mtime - a.mtime);
			if (files.length === 0) return res.status(404).json({ error: 'No status files' });
			const latest = files[0].f;
			try {
				const raw = fs.readFileSync(path.join(tmpDir, latest), 'utf8');
				if (!raw || raw.trim().length === 0) return res.status(202).json({ status: null, note: 'latest status file empty' });
				const data = JSON.parse(raw);
				return res.json({ status: data });
			} catch (parseErr) {
				console.error('backfillStatus parse error for latest', parseErr.message);
				const raw = fs.readFileSync(path.join(tmpDir, latest), 'utf8');
				return res.status(202).json({ status: null, note: 'latest status file incomplete', raw: raw.slice(0, 2000) });
			}
		} catch (err) {
			console.error('backfillStatus error', err);
			res.status(500).json({ error: err.message });
		}
	}
};
