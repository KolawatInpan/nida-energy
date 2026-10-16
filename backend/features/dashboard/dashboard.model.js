const { prisma } = require('../../utils/prisma');

async function getBuildingByMeterId(meterId) {
    // input meterId from hourlyEnergy -> output building
    const result = await prisma.runningMeter.findFirst({
        where: { snid: meterId },
        include: { meter: true }
    })
    return result.meter.buildingName;
}

async function getMeterTypeByMeterId(meterId) {
    const result = await prisma.runningMeter.findFirst({
        where: { snid: meterId},
        include: { meter: true}
    })
    return result.meter.type;
}

async function getAllMetersByBuildingName(buildingName) {
    const result = await prisma.meterInfo.findMany({
        where: { buildingName: buildingName },
    })
    const allMeterIds = result.map(meter => meter.snid);
    return allMeterIds;
}

async function getTypeAndBuildingByMeterId(meterId) {
    const result = await prisma.runningMeter.findFirst({
        where: { snid: meterId },
        include: { meter: true }
    })
    return {
        type: result.meter.type,
        buildingName: result.meter.buildingName
    };
}

async function getAllConsumptionMeters() {
    const result = await prisma.meterInfo.findMany({
        where: { type: "Consume" }
    })
    const allMeterIds = result.map(meter => meter.snid);
    return allMeterIds;
}

async function getAllProducerMeters() {
    const result = await prisma.meterInfo.findMany({
        where: { type: "Produce" }
    })
    const allMeterIds = result.map(meter => meter.snid);
    return allMeterIds;
}

async function getAllBatteryMeters() {
    const result = await prisma.meterInfo.findMany({
        where: { type: "Battery" }
    })
    const allMeterIds = result.map(meter => meter.snid);
    return allMeterIds;
}

async function getHourlyEnergy(filter = {}) {
    // filter: { meterId?: string, date?: string }
    const where = {};
    if (filter.meterId) where.meterSnid = filter.meterId;
    if (filter.date) {
        const d = new Date(filter.date);
        d.setHours(0,0,0,0);
        where.date = d;
    }
    const rows = await prisma.hourlyEnergy.findMany({ where, include: { meter: true } });
    return rows.map(r => ({
      meterId: r.meterSnid,
      date: r.date,
      kWH: r.kwh,
        hours: {
            h0: r.h0, h1: r.h1, h2: r.h2, h3: r.h3, h4: r.h4, h5: r.h5, h6: r.h6, h7: r.h7,
            h8: r.h8, h9: r.h9, h10: r.h10, h11: r.h11, h12: r.h12, h13: r.h13, h14: r.h14, h15: r.h15,
            h16: r.h16, h17: r.h17, h18: r.h18, h19: r.h19, h20: r.h20, h21: r.h21, h22: r.h22, h23: r.h23,
        },
        type: r.meter?.type,
        buildingName: r.meter?.buildingName,
    }));
}

async function getWeeklyEnergy(filter = {}) {
    // filter: { meterId?: string, weekId?: string, week?: string|number, year?: string|number }
    const where = {};
    if (filter.meterId) where.meterSnid = filter.meterId;
    const weekValue = filter.week ?? filter.weekId;
    if (weekValue !== undefined && weekValue !== null && weekValue !== '') {
        where.week = Number(weekValue);
    }
    if (filter.year !== undefined && filter.year !== null && filter.year !== '') {
        where.year = Number(filter.year);
    }
    const rows = await prisma.weeklyEnergy.findMany({ where, include: { meter: true } });
    return rows.map(r => ({
      meterId: r.meterSnid,
        week: r.week,
        year: r.year,
      kWH: r.kwh,
        days: { sun: r.sun, mon: r.mon, tue: r.tue, wed: r.wed, thu: r.thu, fri: r.fri, sat: r.sat },
        type: r.meter?.type,
        buildingName: r.meter?.buildingName,
    }));
}

async function getDailyEnergy(filter = {}) {
    // filter: { meterId?: string, monthId?: string, month?: string|number, year?: string|number }
    const where = {};
    if (filter.meterId) where.meterSnid = filter.meterId;
    const monthValue = filter.month ?? filter.monthId;
    if (monthValue !== undefined && monthValue !== null && monthValue !== '') {
        where.month = Number(monthValue);
    }
    if (filter.year !== undefined && filter.year !== null && filter.year !== '') {
        where.year = Number(filter.year);
    }
    const rows = await prisma.dailyEnergy.findMany({ where, include: { meter: true } });
    return rows.map(r => ({
      meterId: r.meterSnid,
        year: r.year,
        month: r.month,
      kWH: r.kwh,
        days: {
            d1: r.d1, d2: r.d2, d3: r.d3, d4: r.d4, d5: r.d5, d6: r.d6, d7: r.d7, d8: r.d8, d9: r.d9, d10: r.d10,
            d11: r.d11, d12: r.d12, d13: r.d13, d14: r.d14, d15: r.d15, d16: r.d16, d17: r.d17, d18: r.d18, d19: r.d19, d20: r.d20,
            d21: r.d21, d22: r.d22, d23: r.d23, d24: r.d24, d25: r.d25, d26: r.d26, d27: r.d27, d28: r.d28, d29: r.d29, d30: r.d30, d31: r.d31,
        },
        type: r.meter?.type,
        buildingName: r.meter?.buildingName,
    }));
}

async function getMonthlyEnergy(filter = {}) {
    // filter: { meterId?: string, year?: number }
    const where = {};
    if (filter.meterId) where.meterSnid = filter.meterId;
    if (filter.year) where.year = Number(filter.year);
    const rows = await prisma.monthlyEnergy.findMany({ where, include: { meter: true } });
    return rows.map(r => ({
      meterId: r.meterSnid,
        year: r.year,
      kWH: r.kwh,
      months: { M1: r.M1, M2: r.M2, M3: r.M3, M4: r.M4, M5: r.M5, M6: r.M6, M7: r.M7, M8: r.M8, M9: r.M9, M10: r.M10, M11: r.M11, M12: r.M12 },
        type: r.meter?.type,
        buildingName: r.meter?.buildingName,
    }));
}

/**
 * UTC offset (ms) of an IANA timezone at a given instant.
 */
function tzOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return asUTC - date.getTime();
}

/**
 * [start, end] (UTC Dates) of the local day `dateStr` (YYYY-MM-DD) in timezone `tz`.
 * Two-pass offset so DST transitions land on the right boundary.
 */
function dayBoundsInTz(dateStr, tz) {
  const naive = new Date(`${dateStr}T00:00:00Z`);
  const off = tzOffsetMs(naive, tz);
  let start = new Date(naive.getTime() - off);
  start = new Date(naive.getTime() - tzOffsetMs(start, tz));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return [start, end];
}

function formatGapLabel(diffHours) {
  const totalMin = Math.round(diffHours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `No logs for ${m}m`;
  return `No logs for ${h}h${m > 0 ? ` ${m}m` : ''}`;
}

const MIN_GAP_MS = 60 * 60 * 1000; // silences > 1 hour are considered "no data" periods

/**
 * Detect time gaps (>1h) in RunningMeter data for one or several meters.
 * With multiple meterIds the timestamps of ALL meters are UNION-ed — a moment
 * counts as "has data" when ANY meter logs, so gaps mean "every meter was
 * silent" (system-wide), not per-meter silence.
 * Returns silence periods — including edges: before the first log and after
 * the last log inside the requested range.
 */
async function getGaps({ meterId, meterIds, date, from, to, tz }) {
  const ids = (Array.isArray(meterIds) && meterIds.length ? meterIds : (meterId ? [meterId] : []))
    .map((v) => String(v))
    .filter(Boolean);
  if (!ids.length) return [];

  const where = { snid: { in: ids } };

  if (date) {
    if (tz) {
      const [start, end] = dayBoundsInTz(String(date), tz);
      where.timestamp = { gte: start, lte: end };
    } else {
      const d = new Date(date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      where.timestamp = { gte: start, lte: end };
    }
  } else if (from && to) {
    where.timestamp = { gte: new Date(from), lte: new Date(to) };
  }

  const tsRows = await prisma.runningMeter.findMany({
    where,
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' },
  });
  const ts = tsRows.map((r) => new Date(r.timestamp).getTime());

  const rangeStart = where.timestamp?.gte ? new Date(where.timestamp.gte) : null;
  const rangeEnd = where.timestamp?.lte ? new Date(where.timestamp.lte) : null;

  if (ts.length < 2) {
    // If no data at all, the whole period is a gap
    if (ts.length === 0) {
      const start = rangeStart || new Date(date || Date.now());
      const end = rangeEnd || new Date();
      return [{
        from: start.toISOString(),
        to: end.toISOString(),
        durationHours: Math.round((end - start) / (1000 * 60 * 60)),
        label: 'No data available for this period',
      }];
    }
    return [];
  }

  const gaps = [];

  // Edge gap: silence between the range start (or the last log before the range,
  // across all meters) and the first log inside the range.
  if (rangeStart) {
    const first = ts[0];
    const prevRow = await prisma.runningMeter.findFirst({
      where: { snid: { in: ids }, timestamp: { lt: rangeStart } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const gapFrom = prevRow ? new Date(prevRow.timestamp).getTime() : rangeStart.getTime();
    if (first - gapFrom > MIN_GAP_MS) {
      const diffHours = (first - gapFrom) / MIN_GAP_MS;
      gaps.push({
        from: new Date(gapFrom).toISOString(),
        to: new Date(first).toISOString(),
        durationHours: Math.round(diffHours * 10) / 10,
        label: formatGapLabel(diffHours),
      });
    }
  }

  for (let i = 1; i < ts.length; i++) {
    const prev = ts[i - 1];
    const curr = ts[i];
    const diffHours = (curr - prev) / MIN_GAP_MS;

    if (diffHours > 1) {
      gaps.push({
        from: new Date(prev).toISOString(),
        to: new Date(curr).toISOString(),
        durationHours: Math.round(diffHours * 10) / 10,
        label: formatGapLabel(diffHours),
      });
    }
  }

  // Edge gap: silence between the last log inside the range and the range end
  // (or the next log after the range, across all meters).
  if (rangeEnd) {
    const last = ts[ts.length - 1];
    const nextRow = await prisma.runningMeter.findFirst({
      where: { snid: { in: ids }, timestamp: { gt: rangeEnd } },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    });
    const gapTo = nextRow ? new Date(nextRow.timestamp).getTime() : rangeEnd.getTime();
    if (gapTo - last > MIN_GAP_MS) {
      const diffHours = (gapTo - last) / MIN_GAP_MS;
      gaps.push({
        from: new Date(last).toISOString(),
        to: new Date(gapTo).toISOString(),
        durationHours: Math.round(diffHours * 10) / 10,
        label: formatGapLabel(diffHours),
      });
    }
  }

  return gaps;
}

async function searchBuildingEnergy({ building, buildingId, start, end, timeunit = 'day' }) {

    if (!building && !buildingId) throw new Error('building or buildingId is required');
    if (!start || !end) throw new Error('start and end are required');

    // Resolve exact building name from DB if buildingId is provided (overrides name guessing)
    let resolvedBuilding = building;
    let queryBySnids = false;
    let snidsByType = {};
    if (buildingId) {
        const b = await prisma.building.findUnique({ where: { id: parseInt(buildingId, 10) } });
        if (b) {
            resolvedBuilding = b.name;
            // Get ALL meter SNIDs for this building, grouped by type (case-insensitive type match)
            const meters = await prisma.meterInfo.findMany({
                where: { buildingName: b.name },
                select: { snid: true, type: true },
            });
            console.log(`[searchBuildingEnergy] buildingId=${buildingId} name="${b.name}" total meters=${meters.length}`);
            // Group SNIDs by normalized type (e.g., 'producer'/'produce' both → 'produce')
            snidsByType = { produce: [], consume: [], battery: [] };
            meters.forEach((m) => {
                const t = (m.type || '').toLowerCase();
                if (t.startsWith('produc')) snidsByType.produce.push(m.snid);
                else if (t.startsWith('consum') || t.startsWith('consume')) snidsByType.consume.push(m.snid);
                else if (t.includes('battery')) snidsByType.battery.push(m.snid);
            });
            queryBySnids = snidsByType.produce.length > 0 || snidsByType.consume.length > 0 || snidsByType.battery.length > 0;
            console.log(`[searchBuildingEnergy] snids: produce=${snidsByType.produce.length}, consume=${snidsByType.consume.length}, battery=${snidsByType.battery.length}`);
        }
    }

    // Keep date strings as-is (YYYY-MM-DD format from frontend)
    const sDateStr = typeof start === 'string' ? start : new Date(start).toISOString().slice(0, 10);
    const eDateStr = typeof end === 'string' ? end : new Date(end).toISOString().slice(0, 10);

    const unit = timeunit.toLowerCase();

    const runQueryFor = async (meterType) => {
        let rows = [];
        if (queryBySnids && snidsByType[meterType]?.length > 0) {
            // Query by SNID list — no building name + type matching issues
            const typeSnids = snidsByType[meterType];
            if (unit === 'hour') {
                rows = await queryHourlyEnergyBySnids(typeSnids, sDateStr, eDateStr);
            } else if (unit === 'day') {
                rows = await queryDailyEnergyBySnids(typeSnids, sDateStr, eDateStr);
            }
        } else {
            // Fallback: query by building name (original approach)
            if (unit === 'hour') {
                rows = await queryHourlyEnergy(resolvedBuilding, sDateStr, eDateStr, meterType);
            } else if (unit === 'day') {
                rows = await queryDailyEnergy(resolvedBuilding, sDateStr, eDateStr, meterType);
            } else if (unit === 'week') {
                rows = await queryWeeklyEnergy(resolvedBuilding, sDateStr, eDateStr, meterType);
            } else if (unit === 'month') {
                rows = await queryMonthlyEnergy(resolvedBuilding, sDateStr, eDateStr, meterType);
            }
        }
        return transformSeries(rows);
    };

    const consumption = await runQueryFor('consume');
    const production = await runQueryFor('produce');
    const battery = await runQueryFor('battery');

    return { consumption, production, battery };
}

async function queryHourlyEnergy(building, sDateStr, eDateStr, meterType) {
  const sql = `
    SELECT
      to_char((h."date" + (t.i || ' hour')::interval),'YYYY-MM-DD HH24:00') as label,
      COALESCE(t.val,0) as kwh
    FROM "HourlyEnergy" h
    JOIN "MeterInfo" m ON m."snid" = h."meterSnid"
    CROSS JOIN LATERAL (VALUES
      (0,h.h0),(1,h.h1),(2,h.h2),(3,h.h3),(4,h.h4),(5,h.h5),
      (6,h.h6),(7,h.h7),(8,h.h8),(9,h.h9),(10,h.h10),(11,h.h11),
      (12,h.h12),(13,h.h13),(14,h.h14),(15,h.h15),(16,h.h16),(17,h.h17),
      (18,h.h18),(19,h.h19),(20,h.h20),(21,h.h21),(22,h.h22),(23,h.h23)
    ) as t(i,val)
    WHERE h."date" >= $1::date
      AND h."date" <= $2::date
      AND LOWER(m."buildingName") = LOWER($3)
      AND LOWER(m."type") = LOWER($4)
    ORDER BY h."date", t.i
  `;

  return prisma.$queryRawUnsafe(
    sql,
    sDateStr,
    eDateStr,
    building,
    meterType
  );
}

async function queryDailyEnergy(building, sDateStr, eDateStr, meterType) {
  // Parse YYYY-MM-DD strings to extract year for range
  const startYear = parseInt(sDateStr.substring(0, 4));
  const endYear = parseInt(eDateStr.substring(0, 4));

  const sql = `
    SELECT
      to_char(make_date(de."year", de."month", LEAST(t.i, EXTRACT(DAY FROM (make_date(de."year", de."month", 1) + interval '1 month' - interval '1 day'))::int)), 'YYYY-MM-DD') as label,
      COALESCE(t.val,0) as kwh
    FROM "DailyEnergy" de
    JOIN "MeterInfo" m ON m."snid" = de."meterSnid"
    CROSS JOIN LATERAL (VALUES
      (1,de.d1),(2,de.d2),(3,de.d3),(4,de.d4),(5,de.d5),(6,de.d6),
      (7,de.d7),(8,de.d8),(9,de.d9),(10,de.d10),(11,de.d11),(12,de.d12),
      (13,de.d13),(14,de.d14),(15,de.d15),(16,de.d16),(17,de.d17),
      (18,de.d18),(19,de.d19),(20,de.d20),(21,de.d21),(22,de.d22),
      (23,de.d23),(24,de.d24),(25,de.d25),(26,de.d26),(27,de.d27),
      (28,de.d28),(29,de.d29),(30,de.d30),(31,de.d31)
    ) as t(i,val)
    WHERE de."year" >= $1
      AND de."year" <= $2
      AND LOWER(m."buildingName") = LOWER($3)
      AND LOWER(m."type") = LOWER($4)
      AND make_date(de."year", de."month", LEAST(t.i, EXTRACT(DAY FROM (make_date(de."year", de."month", 1) + interval '1 month' - interval '1 day'))::int)) >= $5::date
      AND make_date(de."year", de."month", LEAST(t.i, EXTRACT(DAY FROM (make_date(de."year", de."month", 1) + interval '1 month' - interval '1 day'))::int)) <= $6::date
    ORDER BY label
  `;

  return prisma.$queryRawUnsafe(
    sql,
    startYear,
    endYear,
    building,
    meterType,
    sDateStr,
    eDateStr
  );
}

// Query DailyEnergy by SNID list directly — bypasses building name + type matching
async function queryDailyEnergyBySnids(snids, sDateStr, eDateStr) {
  const startYear = parseInt(sDateStr.substring(0, 4));
  const endYear = parseInt(eDateStr.substring(0, 4));
  if (!Array.isArray(snids) || snids.length === 0) return [];

  const sql = `
    SELECT
      to_char(make_date(de."year", de."month", LEAST(t.i, EXTRACT(DAY FROM (make_date(de."year", de."month", 1) + interval '1 month' - interval '1 day'))::int)), 'YYYY-MM-DD') as label,
      COALESCE(t.val,0) as kwh
    FROM "DailyEnergy" de
    CROSS JOIN LATERAL (VALUES
      (1,de.d1),(2,de.d2),(3,de.d3),(4,de.d4),(5,de.d5),(6,de.d6),
      (7,de.d7),(8,de.d8),(9,de.d9),(10,de.d10),(11,de.d11),(12,de.d12),
      (13,de.d13),(14,de.d14),(15,de.d15),(16,de.d16),(17,de.d17),
      (18,de.d18),(19,de.d19),(20,de.d20),(21,de.d21),(22,de.d22),
      (23,de.d23),(24,de.d24),(25,de.d25),(26,de.d26),(27,de.d27),
      (28,de.d28),(29,de.d29),(30,de.d30),(31,de.d31)
    ) as t(i,val)
    WHERE de."meterSnid" = ANY($3::text[])
      AND de."year" >= $1
      AND de."year" <= $2
      AND make_date(de."year", de."month", LEAST(t.i, EXTRACT(DAY FROM (make_date(de."year", de."month", 1) + interval '1 month' - interval '1 day'))::int)) >= $4::date
      AND make_date(de."year", de."month", LEAST(t.i, EXTRACT(DAY FROM (make_date(de."year", de."month", 1) + interval '1 month' - interval '1 day'))::int)) <= $5::date
    ORDER BY label
  `;

  return prisma.$queryRawUnsafe(sql, startYear, endYear, snids, sDateStr, eDateStr);
}

// Query HourlyEnergy by SNID list directly
async function queryHourlyEnergyBySnids(snids, sDateStr, eDateStr) {
  if (!Array.isArray(snids) || snids.length === 0) return [];

  const sql = `
    SELECT
      to_char((h."date" + (t.i || ' hour')::interval),'YYYY-MM-DD HH24:00') as label,
      COALESCE(t.val,0) as kwh
    FROM "HourlyEnergy" h
    CROSS JOIN LATERAL (VALUES
      (0,h.h0),(1,h.h1),(2,h.h2),(3,h.h3),(4,h.h4),(5,h.h5),
      (6,h.h6),(7,h.h7),(8,h.h8),(9,h.h9),(10,h.h10),(11,h.h11),
      (12,h.h12),(13,h.h13),(14,h.h14),(15,h.h15),(16,h.h16),(17,h.h17),
      (18,h.h18),(19,h.h19),(20,h.h20),(21,h.h21),(22,h.h22),(23,h.h23)
    ) as t(i,val)
    WHERE h."date" >= $1::date
      AND h."date" <= $2::date
      AND h."meterSnid" = ANY($3::text[])
    ORDER BY h."date", t.i
  `;

  return prisma.$queryRawUnsafe(sql, sDateStr, eDateStr, snids);
}

async function queryWeeklyEnergy(building, sDateStr, eDateStr, meterType) {
  const sql = `
    SELECT
      concat(w."year", '-W', LPAD(w."week"::text, 2, '0'), '-', t.day) as label,
      COALESCE(t.val,0) as kwh
    FROM "WeeklyEnergy" w
    JOIN "MeterInfo" m ON m."snid" = w."meterSnid"
    CROSS JOIN LATERAL (VALUES
      ('Sun', w.sun),('Mon', w.mon),('Tue', w.tue),
      ('Wed', w.wed),('Thu', w.thu),('Fri', w.fri),('Sat', w.sat)
    ) as t(day,val)
    WHERE LOWER(m."buildingName") = LOWER($1)
      AND LOWER(m."type") = LOWER($2)
      AND to_date(
        w."year"::text || '-' || LPAD(w."week"::text, 2, '0') || '-1',
        'IYYY-IW-ID'
      ) <= $4::date
      AND (
        to_date(
          w."year"::text || '-' || LPAD(w."week"::text, 2, '0') || '-1',
          'IYYY-IW-ID'
        ) + interval '6 day'
      ) >= $3::date
    ORDER BY w."year", w."week"
  `;

  return prisma.$queryRawUnsafe(
    sql,
    building,
    meterType,
    sDateStr,
    eDateStr
  );
}

async function queryMonthlyEnergy(building, sDateStr, eDateStr, meterType) {
  // Parse YYYY-MM-DD strings to extract year for range
  const startYear = parseInt(sDateStr.substring(0, 4));
  const endYear = parseInt(eDateStr.substring(0, 4));

  const sql = `
    SELECT
      to_char(make_date(me."year", t.i, 1), 'YYYY-MM') as label,
      COALESCE(t.val,0) as kwh
    FROM "MonthlyEnergy" me
    JOIN "MeterInfo" m ON m."snid" = me."meterSnid"
    CROSS JOIN LATERAL (VALUES
      (1,me."M1"),(2,me."M2"),(3,me."M3"),(4,me."M4"),(5,me."M5"),(6,me."M6"),
      (7,me."M7"),(8,me."M8"),(9,me."M9"),(10,me."M10"),(11,me."M11"),(12,me."M12")
    ) as t(i,val)
    WHERE me."year" >= $1
      AND me."year" <= $2
      AND LOWER(m."buildingName") = LOWER($3)
      AND LOWER(m."type") = LOWER($4)
      AND make_date(me."year", t.i, 1) >= date_trunc('month', $5::date)::date
      AND make_date(me."year", t.i, 1) <= date_trunc('month', $6::date)::date
    ORDER BY label
  `;

  return prisma.$queryRawUnsafe(
    sql,
    startYear,
    endYear,
    building,
    meterType,
    sDateStr,
    eDateStr
  );
}

function transformSeries(rows){

    const map = new Map();

    for(const r of rows){

        const label = r.label;
        const kwh = Number(r.kwh || 0);

        map.set(label,(map.get(label) || 0) + kwh);
    }

    return {
        datetime:Array.from(map.keys()),
        value:Array.from(map.values())
    };
}

module.exports = {
    getBuildingByMeterId,
    getMeterTypeByMeterId,
    getAllMetersByBuildingName,
    getTypeAndBuildingByMeterId,
    getAllConsumptionMeters,
    getAllProducerMeters,
    getAllBatteryMeters,
    getHourlyEnergy,
    getDailyEnergy,
    getWeeklyEnergy,
    getMonthlyEnergy,
    searchBuildingEnergy,
    getGaps,
}


