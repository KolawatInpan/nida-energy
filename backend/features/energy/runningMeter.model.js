const { prisma } = require('../../utils/prisma');
const { syncMeterSnapshotAndBuildingEnergy } = require('./energyAggregation');
const { createProfileGenerator } = require('./runningMeter.utils');

/**
 * Create a single RunningMeter entry for a given meter snid.
 * Fields must match Prisma model: snid, timestamp, kW, kWH, txid?
 */
async function createRunningEntry(snid, timestamp, kW, kWH, txid = null) {
    const created = await prisma.runningMeter.create({
        data: {
            snid,
            timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
            txid: txid || null,
            kW: typeof kW !== 'undefined' ? kW : null,
            kWH: typeof kWH !== 'undefined' ? kWH : null,
        },
    });

    // update aggregates for this single entry
    try {
        await updateAggregates([{ snid: created.snid, timestamp: created.timestamp, kWH: created.kWH }]);
    } catch (err) {
        console.error('Failed to update aggregates for single runningMeter:', err);
    }

    return created;
}

/**
 * Generate hourly RunningMeter entries for a snid between start and end.
 * start and end can be Date or ISO strings. Generates entries at each hour: start, start+1h, ..., < end.
 * options:
 *  - intervalHours (default 1)
 *  - valueGenerator: function(index, timestamp) -> { kW, kWH }
 */
async function generateHourlyEntries(snid, start, end, options = {}) {
    const intervalHours = options.intervalHours || 1;
    // choose value generator: explicit function > named profile > default random
    let valueGenerator = null;
    if (typeof options.valueGenerator === 'function') {
        valueGenerator = options.valueGenerator;
    } else {
        const profile = options.valueProfile || 'random';
        valueGenerator = createProfileGenerator(profile, options.profileParams || {});
    }

    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    if (isNaN(startDate) || isNaN(endDate)) throw new Error('Invalid start or end date');
    if (endDate <= startDate) throw new Error('End must be after start');

    const records = [];
    let cursor = new Date(startDate);
    let idx = 0;
    while (cursor < endDate) {
        // generate values for the interval starting at cursor
        const { kW, kWH } = valueGenerator(idx, new Date(cursor));
        // store timestamp at the END of the interval so UI shows the reading at the hour boundary (e.g., 19:00)
        const recordTs = new Date(cursor.getTime() + intervalHours * 60 * 60 * 1000);
        records.push({
            snid,
            timestamp: recordTs,
            kW: kW,
            kWH: kWH,
        });
        // advance
        cursor = new Date(cursor.getTime() + intervalHours * 60 * 60 * 1000);
        idx += 1;
    }

    if (records.length === 0) return { count: 0 };

    // Use createMany for performance. Note: createMany does not return created records.
        // Use skipDuplicates to avoid errors when the same (snid,timestamp) already exists
        const result = await prisma.runningMeter.createMany({ data: records, skipDuplicates: true });

        // update aggregated tables (HourlyEnergy, DailyEnergy, WeeklyEnergy, MonthlyEnergy)
        try {
            await updateAggregates(records);
            const latestRecord = records[records.length - 1];
            if (latestRecord) {
                await syncMeterSnapshotAndBuildingEnergy({
                    snid,
                    timestamp: latestRecord.timestamp,
                    kW: latestRecord.kW,
                    kWH: latestRecord.kWH,
                });
            }
        } catch (aggErr) {
            console.error('Failed to update aggregates:', aggErr);
        }

        return result;
}

// ---------- Aggregation helpers ----------
function getIsoWeekNumber(d) {
    // Copy date so don't modify original
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

const meterNameCache = new Map();
async function resolveMeterName(snid) {
    if (meterNameCache.has(snid)) return meterNameCache.get(snid);
    // meterName field was removed from Prisma schema; fetch whole record and fall back to snid
    const m = await prisma.meterInfo.findUnique({ where: { snid } });
    const name = m?.meterName || m?.snid || m?.buildingName || null;
    meterNameCache.set(snid, name);
    return name;
}

async function updateAggregates(records) {
    for (const r of records) {
        const snid = r.snid;
        const ts = new Date(r.timestamp);
        const kWH = Number(r.kWH || 0);
        if (!snid || isNaN(ts)) continue;

            // Use snid as the aggregation key (schema now uses meterSnid)
            const meterKey = snid;

            // HourlyEnergy: date (local yyyy-mm-dd), h0..h23
            const y = ts.getFullYear();
            const m = ts.getMonth() + 1;
            const d = ts.getDate();
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hour = ts.getHours();
            const hourField = `h${hour}`;
            // validate hour field
            if (!/^h([0-9]|1[0-9]|2[0-3])$/.test(hourField)) continue;
            const hourlySql = `INSERT INTO "HourlyEnergy"("meterSnid","date","${hourField}","kwh") VALUES ($1, $2::date, $3, $4)
                ON CONFLICT ("meterSnid","date") DO UPDATE SET "${hourField}" = COALESCE("HourlyEnergy"."${hourField}",0) + $3, "kwh" = COALESCE("HourlyEnergy"."kwh",0) + $4`;
            await prisma.$executeRawUnsafe(hourlySql, meterKey, dateStr, kWH, kWH);

        // DailyEnergy: schema uses (meterSnid, year, month)
        const month = m;
        const dayField = `d${d}`;
        if (!/^d([1-9]|[12][0-9]|3[01])$/.test(dayField)) continue;
        const dailySql = `INSERT INTO "DailyEnergy"("meterSnid","year","month","${dayField}","kwh") VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT ("meterSnid","year","month") DO UPDATE SET "${dayField}" = COALESCE("DailyEnergy"."${dayField}",0) + $4, "kwh" = COALESCE("DailyEnergy"."kwh",0) + $5`;
        await prisma.$executeRawUnsafe(dailySql, meterKey, y, month, kWH, kWH);

        // WeeklyEnergy: schema uses (meterSnid, year, week) with lowercase weekday columns sun..sat
        const weekNumber = getIsoWeekNumber(ts);
        const weekdayNames = ['sun','mon','tue','wed','thu','fri','sat'];
        const weekdayField = weekdayNames[ts.getDay()];
        if (!/^(sun|mon|tue|wed|thu|fri|sat)$/.test(weekdayField)) continue;
        const weeklySql = `INSERT INTO "WeeklyEnergy"("meterSnid","year","week","${weekdayField}","kwh") VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT ("meterSnid","year","week") DO UPDATE SET "${weekdayField}" = COALESCE("WeeklyEnergy"."${weekdayField}",0) + $4, "kwh" = COALESCE("WeeklyEnergy"."kwh",0) + $5`;
        await prisma.$executeRawUnsafe(weeklySql, meterKey, y, weekNumber, kWH, kWH);

        // MonthlyEnergy: year, M1..M12
        const monthField = `M${m}`;
        if (!/^M([1-9]|1[0-2])$/.test(monthField)) continue;
        const monthlySql = `INSERT INTO "MonthlyEnergy"("meterSnid","year","${monthField}","kwh") VALUES ($1,$2,$3,$4)
            ON CONFLICT ("meterSnid","year") DO UPDATE SET "${monthField}" = COALESCE("MonthlyEnergy"."${monthField}",0) + $3, "kwh" = COALESCE("MonthlyEnergy"."kwh",0) + $4`;
        await prisma.$executeRawUnsafe(monthlySql, meterKey, y, kWH, kWH);
    }
}

module.exports = {
    createRunningEntry,
    generateHourlyEntries,
};


