const { prisma } = require('../../utils/prisma');

function getIsoWeekNumber(d) {
	const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const dayNum = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
	const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
	return weekNo;
}

async function getBuildingEnergy(req, res) {
	try {
		const { start, end, timeunit, meterType } = req.query;
		if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
		const startDate = new Date(start);
		const endDate = new Date(end);
		if (isNaN(startDate) || isNaN(endDate)) return res.status(400).json({ error: 'invalid dates' });

		const unit = (timeunit || 'day').toLowerCase();
		let rows = [];

		if (unit === 'hour') {
			const hourlyRows = await prisma.hourlyEnergy.findMany({ where: { date: { gte: startDate, lte: endDate } }, include: { meter: true } });
			rows = [];
			for (const h of hourlyRows) {
				const buildingName = h.meter?.buildingName || '';
				const dateStr = (new Date(h.date)).toISOString().slice(0,10);
				for (let i = 0; i < 24; i++) {
					const val = Number(h[`h${i}`] || 0);
					rows.push({ buildingName, label: `${dateStr} ${String(i).padStart(2,'0')}:00`, kwh: val });
				}
			}
		} else if (unit === 'month') {
			const startYear = startDate.getFullYear();
			const endYear = endDate.getFullYear();
			const monthlyRows = await prisma.monthlyEnergy.findMany({ where: { year: { gte: startYear, lte: endYear } }, include: { meter: true } });
			rows = [];
			for (const me of monthlyRows) {
				const buildingName = me.meter?.buildingName || '';
				for (let i = 1; i <= 12; i++) {
					const val = Number(me[`M${i}`] || 0);
					const monthStr = `${me.year}-${String(i).padStart(2,'0')}`;
					const monthDate = new Date(`${me.year}-${String(i).padStart(2,'0')}-01`);
					if (monthDate >= startDate && monthDate <= endDate) rows.push({ buildingName, label: monthStr, kwh: val });
				}
			}
		} else if (unit === 'week') {
			const startWeek = getIsoWeekNumber(startDate);
			const endWeek = getIsoWeekNumber(endDate);
			const startYear = startDate.getFullYear();
			const endYear = endDate.getFullYear();
			const weeklyRows = await prisma.weeklyEnergy.findMany({ where: { year: { gte: startYear, lte: endYear }, week: { gte: startWeek, lte: endWeek } }, include: { meter: true } });
			rows = [];
			const dayOrder = [ ['Sun','sun'], ['Mon','mon'], ['Tue','tue'], ['Wed','wed'], ['Thu','thu'], ['Fri','fri'], ['Sat','sat'] ];
			for (const w of weeklyRows) {
				const meter = w.meter || {};
				const buildingName = meter.buildingName || '';
				const weekId = w.week;
				for (const [labelDay, field] of dayOrder) {
					const val = Number(w[field] || 0);
					rows.push({ buildingName, label: `W${weekId}-${labelDay}`, kwh: val });
				}
			}
		} else {
			try {
				const startMonth = startDate.getMonth() + 1;
				const endMonth = endDate.getMonth() + 1;
				const startYear = startDate.getFullYear();
				const endYear = endDate.getFullYear();
				const dailyRows = await prisma.dailyEnergy.findMany({ where: { year: { gte: startYear, lte: endYear }, month: { gte: startMonth, lte: endMonth } }, include: { meter: true } });
				rows = [];
				for (const de of dailyRows) {
					const buildingName = de.meter?.buildingName || '';
					const monthId = de.month;
					const yearPrefix = String(de.year);
					for (let i = 1; i <= 31; i++) {
						const val = Number(de[`d${i}`] || 0);
						const dateStr = `${yearPrefix}${String(monthId).padStart(2,'0')}${String(i).padStart(2,'0')}`;
						const dateObj = new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`);
						if (dateObj >= startDate && dateObj <= endDate) rows.push({ buildingName, label: dateObj.toISOString().slice(0,10), kwh: val });
					}
				}
			} catch (e) {
				const fallbackSql = `SELECT b."name" as "buildingName", to_char(date_trunc('day', rm."timestamp"),'YYYY-MM-DD') as label, SUM(rm."kWH") as kwh
					FROM "RunningMeter" rm
					JOIN "MeterInfo" m ON m."snid" = rm."snid"
					JOIN "Building" b ON b."name" = m."buildingName"
					WHERE rm."timestamp" >= $1::timestamp AND rm."timestamp" <= $2::timestamp
						AND ($3::text IS NULL OR ($3::text = 'produce' AND LOWER(m."type") = 'produce') OR ($3::text = 'consume' AND LOWER(m."type") = 'consume'))
					GROUP BY b."name", date_trunc('day', rm."timestamp")
					ORDER BY b."name", date_trunc('day', rm."timestamp")`;
				rows = await prisma.$queryRawUnsafe(fallbackSql, startDate.toISOString(), endDate.toISOString(), meterType || null);
			}
		}

		const map = new Map();
		for (const r of rows) {
			const rawName = r.buildingName || '';
			const b = rawName.toString().toLowerCase();
			const label = r.label;
			const kwh = Number(r.kwh || 0);
			if (!map.has(b)) map.set(b, { building_name: b, datetime: [], value: [] });
			map.get(b).datetime.push(label);
			map.get(b).value.push(kwh);
		}

		return res.json({ result: 'success', data: Array.from(map.values()) });
	} catch (err) {
		console.error('getBuildingEnergy error', err);
		return res.status(500).json({ error: err.message });
	}
}

module.exports = { getBuildingEnergy };
