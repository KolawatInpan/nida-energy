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

async function getBatteryChargeSources(req, res) {
	try {
		const { snid } = req.params;
		const { days = 7 } = req.query;
		if (!snid) return res.status(400).json({ error: 'snid is required' });

		const { prisma } = require('../../utils/prisma');
		const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

		// Get meter's building info
		const meter = await prisma.meterInfo.findUnique({
			where: { snid: String(snid) },
			select: { buildingName: true, building: { select: { email: true } } },
		});
		const buildingName = meter?.buildingName || 'Unknown';

		// Charge: kW > 0
		const chargeRows = await prisma.runningMeter.findMany({
			where: { snid: String(snid), timestamp: { gte: since }, kW: { gt: 0 } },
			select: { kW: true, source: true },
			orderBy: { timestamp: 'desc' },
		});

		const chargeMap = {};
		for (const r of chargeRows) {
			const src = r.source || 'UNKNOWN';
			chargeMap[src] = (chargeMap[src] || 0) + Number(r.kW || 0);
		}

		const chargeSources = Object.entries(chargeMap)
			.map(([source, kwh]) => ({ source, kwh: Math.round(kwh * 100) / 100 }))
			.sort((a, b) => b.kwh - a.kwh);

		const totalChargeKwh = chargeSources.reduce((s, x) => s + x.kwh, 0);

		// Discharge: kW < 0 (absolute value = energy discharged)
		const dischargeRows = await prisma.runningMeter.findMany({
			where: { snid: String(snid), timestamp: { gte: since }, kW: { lt: 0 } },
			select: { kW: true, source: true },
		});

		const dischargeMap = {};
		for (const r of dischargeRows) {
			// SOLD = market sale; null/empty = self-consumption
			const src = (r.source === 'SOLD') ? 'MARKET' : 'SELF';
			dischargeMap[src] = (dischargeMap[src] || 0) + Math.abs(Number(r.kW || 0));
		}

		const dischargeSources = Object.entries(dischargeMap)
			.map(([source, kwh]) => ({ source, kwh: Math.round(kwh * 100) / 100 }))
			.sort((a, b) => b.kwh - a.kwh);

		const totalDischargeKwh = dischargeSources.reduce((s, x) => s + x.kwh, 0);

		// How much energy is currently offered in marketplace from this building
		let offeredKwh = 0;
		try {
			const wallet = await prisma.wallet.findFirst({ where: { email: meter?.building?.email || '' }, select: { id: true } });
			if (wallet?.id) {
				const offers = await prisma.energyOffer.findMany({
					where: { sellerWalletId: String(wallet.id), status: 'AVAILABLE' },
					select: { kWH: true, kWHSold: true },
				});
				offeredKwh = Math.round(offers.reduce((sum, o) => sum + Math.max(0, Number(o.kWH || 0) - Number(o.kWHSold || 0)), 0) * 100) / 100;
			}
		} catch (e) { /* ignore */ }

		res.json({
			snid,
			buildingName,
			days: Number(days),
			chargeTotalKwh: Math.round(totalChargeKwh * 100) / 100,
			chargeSources,
			dischargeTotalKwh: totalDischargeKwh,
			dischargeSources,
			offeredKwh,
		});
	} catch (err) {
		console.error('getBatteryChargeSources error', err);
		res.status(500).json({ error: err.message });
	}
}

/**
 * GET /api/runningMeters/soc-series/:snid?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns the battery's REAL State-of-Charge series (daily) from RunningMeter.kWH.
 * kWH for battery meters is already the integrated SoC (clamped to capacity),
 * so we return it directly — NOT a flow sum. Groups to one value per day
 * (last reading of the day) so charts show the actual SoC.
 */
async function getBatterySocSeries(req, res) {
	try {
		const { snid } = req.params;
		const { start, end, timeunit = 'day' } = req.query;
		if (!snid) return res.status(400).json({ error: 'snid is required' });

		const { prisma } = require('../../utils/prisma');

		const meter = await prisma.meterInfo.findUnique({
			where: { snid: String(snid) },
			select: { snid: true, capacity: true, value: true, kWH: true },
		});
		if (!meter) return res.status(404).json({ error: 'Meter not found' });

		const capacity = Number(meter.capacity || 0);

		const since = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const until = end ? new Date(end) : new Date();

		const rows = await prisma.runningMeter.findMany({
			where: { snid: String(snid), timestamp: { gte: since, lte: until } },
			select: { timestamp: true, kWH: true },
			orderBy: { timestamp: 'asc' },
		});

		// Group into daily buckets: keep the LAST reading of each day as the day's SoC
		const dayMap = new Map(); // YYYY-MM-DD -> kWH (SoC)
		for (const r of rows) {
			const dayKey = r.timestamp.toISOString().slice(0, 10);
			dayMap.set(dayKey, Number(r.kWH ?? 0));
		}

		const days = [...dayMap.keys()].sort();
		const value = days.map((d) => {
			const socKwh = dayMap.get(d);
			if (capacity > 0) {
				return Math.max(0, Math.min(100, Math.round((socKwh / capacity) * 100)));
			}
			return Math.round(socKwh);
		});

		res.json({
			snid,
			capacity,
			timeunit,
			datetime: days,
			value,
			// current snapshot
			currentKwh: Number(meter.kWH ?? 0),
			currentPct: capacity > 0 ? Math.max(0, Math.min(100, Math.round((Number(meter.kWH ?? 0) / capacity) * 100))) : null,
		});
	} catch (err) {
		console.error('getBatterySocSeries error', err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = {
	createRunningEntry,
	generateHourlyEntries,
	insertRunningLog,
	insertRunningLogsBulk,
	getBatteryChargeSources,
	getBatterySocSeries,
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
