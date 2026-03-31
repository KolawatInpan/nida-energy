const { prisma } = require('../../utils/prisma');

function getIsoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

/**
 * GET /api/energy/buildings?start=ISO&end=ISO
 * Returns per-building daily timeseries between start and end (inclusive)
 */
async function getBuildingEnergy(req, res) {
  try {
    const { start, end, timeunit, meterType } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate)) return res.status(400).json({ error: 'invalid dates' });

    // Choose data source based on requested timeunit. Prefer aggregate tables when available.
    const unit = (timeunit || 'day').toLowerCase();
    let rows = [];

    if (unit === 'hour') {
      // Use Prisma to fetch HourlyEnergy rows and expand h0..h23 in JS
      const hourlyRows = await prisma.hourlyEnergy.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        include: { meter: true }
      });
      rows = [];
      for (const h of hourlyRows) {
        const buildingName = h.meter?.buildingName || '';
        const dateStr = (new Date(h.date)).toISOString().slice(0,10);
        for (let i = 0; i < 24; i++) {
          const val = Number(h[`h${i}`] || 0);
          const hourLabel = `${dateStr} ${String(i).padStart(2,'0')}:00`;
          rows.push({ buildingName, label: hourLabel, kwh: val });
        }
      }

    } else if (unit === 'month') {
      // Use Prisma to fetch MonthlyEnergy rows and expand M1..M12
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const monthlyRows = await prisma.monthlyEnergy.findMany({
        where: { year: { gte: startYear, lte: endYear } },
        include: { meter: true }
      });
      rows = [];
      for (const me of monthlyRows) {
        const buildingName = me.meter?.buildingName || '';
        for (let i = 1; i <= 12; i++) {
          const val = Number(me[`M${i}`] || 0);
          const monthStr = `${me.year}-${String(i).padStart(2,'0')}`;
          // only include months within the requested date range
          const monthDate = new Date(`${me.year}-${String(i).padStart(2,'0')}-01`);
          if (monthDate >= startDate && monthDate <= endDate) rows.push({ buildingName, label: monthStr, kwh: val });
        }
      }

    } else if (unit === 'week') {
      // Use Prisma to fetch WeeklyEnergy rows and expand Sun..Sat into weekday buckets.
      const startWeek = getIsoWeekNumber(startDate);
      const endWeek = getIsoWeekNumber(endDate);
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const weeklyRows = await prisma.weeklyEnergy.findMany({
        where: {
          year: { gte: startYear, lte: endYear },
          week: { gte: startWeek, lte: endWeek }
        },
        include: { meter: true }
      });

      // transform to same shape as raw SQL: array of { buildingName, label, kwh }
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
      // default: 'day' -> use DailyEnergy if possible, else fall back to RunningMeter aggregation
      try {
          // DailyEnergy: fetch with Prisma and expand d1..d31; filter expanded dates to requested range
          const startMonth = startDate.getMonth() + 1;
          const endMonth = endDate.getMonth() + 1;
          const startYear = startDate.getFullYear();
          const endYear = endDate.getFullYear();
          const dailyRows = await prisma.dailyEnergy.findMany({
            where: {
              year: { gte: startYear, lte: endYear },
              month: { gte: startMonth, lte: endMonth }
            },
            include: { meter: true }
          });
          rows = [];
          for (const de of dailyRows) {
            const buildingName = de.meter?.buildingName || '';
            const monthId = de.month;
            const yearPrefix = String(de.year);
            for (let i = 1; i <= 31; i++) {
              const val = Number(de[`d${i}`] || 0);
              const dateStr = `${yearPrefix}${String(monthId).padStart(2,'0')}${String(i).padStart(2,'0')}`; // YYYYMMDD
              const dateObj = new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`);
              if (dateObj >= startDate && dateObj <= endDate) {
                const label = dateObj.toISOString().slice(0,10);
                rows.push({ buildingName, label, kwh: val });
              }
            }
          }
      } catch (e) {
        // fallback: aggregate RunningMeter by day
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

    // transform to expected frontend shape: array of { building_name, datetime: [...], value: [...] }
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

module.exports = {
  getBuildingEnergy,
};


