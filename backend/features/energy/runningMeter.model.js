const { prisma } = require('../../utils/prisma');
const { syncMeterSnapshotAndBuildingEnergy } = require('./energyAggregation');

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
        // helper to create generators
        const createProfileGenerator = (profileName, params = {}) => {
            if (profileName === 'fixed') {
                const fixedKW = typeof params.kW !== 'undefined' ? params.kW : 1.0;
                return () => ({ kW: fixedKW, kWH: fixedKW });
            }
            if (profileName === 'sinusoidal') {
                // params: min, max, phaseShiftHours (0-23)
                const min = typeof params.min !== 'undefined' ? params.min : 0.1;
                const max = typeof params.max !== 'undefined' ? params.max : 5.0;
                const phase = typeof params.phaseShiftHours !== 'undefined' ? params.phaseShiftHours : 15; // peak at 15:00
                const amplitude = (max - min) / 2;
                const mid = (max + min) / 2;
                return (i, ts) => {
                    const hour = ts.getHours();
                    // angle in radians for 24h cycle
                    const angle = ((hour - phase) / 24) * 2 * Math.PI;
                    const base = mid + amplitude * Math.sin(angle);
                    // add small noise
                    const noise = (Math.random() - 0.5) * Math.max(0.05, amplitude * 0.1);
                    const kW = +(Math.max(min, base + noise)).toFixed(4);
                    return { kW, kWH: +kW.toFixed(4) };
                };
            }
            if (profileName === 'peak') {
                // low off-peak and higher during daytime
                const off = typeof params.off !== 'undefined' ? params.off : 0.2;
                const peak = typeof params.peak !== 'undefined' ? params.peak : 4.0;
                const startPeak = typeof params.startPeakHour !== 'undefined' ? params.startPeakHour : 7;
                const endPeak = typeof params.endPeakHour !== 'undefined' ? params.endPeakHour : 19;
                return (i, ts) => {
                    const hour = ts.getHours();
                    const inPeak = hour >= startPeak && hour < endPeak;
                    const base = inPeak ? peak : off;
                    const noise = (Math.random() - 0.5) * Math.max(0.05, base * 0.1);
                    const kW = +(Math.max(0, base + noise)).toFixed(4);
                    return { kW, kWH: +kW.toFixed(4) };
                };
            }
            // default random
            return () => {
                const kW = +(Math.random() * 4.9 + 0.1).toFixed(4);
                return { kW, kWH: kW };
            };
        };

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
        const { kW, kWH } = valueGenerator(idx, new Date(cursor));
        records.push({
            snid,
            timestamp: new Date(cursor),
            kW: kW,
            kWH: kWH,
        });
        // advance
        cursor = new Date(cursor.getTime() + intervalHours * 60 * 60 * 1000);
        idx += 1;
    }

    if (records.length === 0) return { count: 0 };

    // Use createMany for performance. Note: createMany does not return created records.
        const result = await prisma.runningMeter.createMany({ data: records });

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
    const m = await prisma.meterInfo.findUnique({ where: { snid }, select: { meterName: true } });
    const name = m?.meterName || null;
    meterNameCache.set(snid, name);
    return name;
}

async function updateAggregates(records) {
    for (const r of records) {
        const snid = r.snid;
        const ts = new Date(r.timestamp);
        const kWH = Number(r.kWH || 0);
        if (!snid || isNaN(ts)) continue;

        const meterName = await resolveMeterName(snid);
        if (!meterName) continue;

        // HourlyEnergy: date (local yyyy-mm-dd), h0..h23
        const y = ts.getFullYear();
        const m = ts.getMonth() + 1;
        const d = ts.getDate();
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hour = ts.getHours();
        const hourField = `h${hour}`;
        // validate hour field
        if (!/^h([0-9]|1[0-9]|2[0-3])$/.test(hourField)) continue;
        const hourlySql = `INSERT INTO "HourlyEnergy"("meterName","date","${hourField}","kwh") VALUES ($1, $2::date, $3, $4)
            ON CONFLICT ("meterName","date") DO UPDATE SET "${hourField}" = COALESCE("HourlyEnergy"."${hourField}",0) + $3, "kwh" = COALESCE("HourlyEnergy"."kwh",0) + $4`;
        await prisma.$executeRawUnsafe(hourlySql, meterName, dateStr, kWH, kWH);

        // DailyEnergy: monthId is month number (1-12)
        const monthId = m;
        const dayField = `d${d}`;
        if (!/^d([1-9]|[12][0-9]|3[01])$/.test(dayField)) continue;
        const dailySql = `INSERT INTO "DailyEnergy"("meterName","monthId","${dayField}","kwh") VALUES ($1,$2,$3,$4)
            ON CONFLICT ("meterName","monthId") DO UPDATE SET "${dayField}" = COALESCE("DailyEnergy"."${dayField}",0) + $3, "kwh" = COALESCE("DailyEnergy"."kwh",0) + $4`;
        await prisma.$executeRawUnsafe(dailySql, meterName, monthId, kWH, kWH);

        // WeeklyEnergy: weekId = year*100 + weekNumber; Sun..Sat fields
        const weekNumber = getIsoWeekNumber(ts);
        const weekId = weekNumber; // store week number (1-53)
        const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const weekdayField = weekdayNames[ts.getDay()];
        if (!/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/.test(weekdayField)) continue;
        const weeklySql = `INSERT INTO "WeeklyEnergy"("meterName","weekId","${weekdayField}","kwh") VALUES ($1,$2,$3,$4)
            ON CONFLICT ("meterName","weekId") DO UPDATE SET "${weekdayField}" = COALESCE("WeeklyEnergy"."${weekdayField}",0) + $3, "kwh" = COALESCE("WeeklyEnergy"."kwh",0) + $4`;
        await prisma.$executeRawUnsafe(weeklySql, meterName, weekId, kWH, kWH);

        // MonthlyEnergy: year, M1..M12
        const monthField = `M${m}`;
        if (!/^M([1-9]|1[0-2])$/.test(monthField)) continue;
        const monthlySql = `INSERT INTO "MonthlyEnergy"("meterName","year","${monthField}","kwh") VALUES ($1,$2,$3,$4)
            ON CONFLICT ("meterName","year") DO UPDATE SET "${monthField}" = COALESCE("MonthlyEnergy"."${monthField}",0) + $3, "kwh" = COALESCE("MonthlyEnergy"."kwh",0) + $4`;
        await prisma.$executeRawUnsafe(monthlySql, meterName, y, kWH, kWH);
    }
}

module.exports = {
    createRunningEntry,
    generateHourlyEntries,
};


