const { prisma } = require('../../utils/prisma');
const invoiceService = require('../billing/invoice.service');
const fs = require('fs');
const path = require('path');

// syncCursor.txt is the single source of truth for the energy feed cursor.
// It MUST be deleted when logs are reset, otherwise the feed thinks it already
// synced past old data and will not re-pull history (e.g. after clearing logs
// with the Mock Energy Reset button, old days never come back).
const SYNC_CURSOR_FILE = path.join(__dirname, 'syncCursor.txt');

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo4(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 10000) / 10000;
}

function createHourlyDefaults() {
  return Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`h${index}`, 0]));
}

function createDailyDefaults() {
  return Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`d${index + 1}`, 0]));
}

function createWeeklyDefaults() {
  return {
    sun: 0,
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
  };
}

function createMonthlyDefaults() {
  return Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`M${index + 1}`, 0]));
}

function isProduceMeter(type = '') {
  const normalized = String(type || '').toLowerCase();
  return normalized.includes('produce') || normalized.includes('producer') || normalized.includes('solar') || normalized.includes('pv');
}

async function syncBuildingEnergyForBuilding(buildingName, prismaClient = prisma) {
  if (!buildingName) return null;

  const producerMeters = await prismaClient.meterInfo.findMany({
    where: { buildingName }
  });

  const totalEnergy = producerMeters
    .filter((meter) => isProduceMeter(meter.type))
    .reduce((sum, meter) => {
      const currentValue = toFiniteNumber(meter.value);
      const currentKwh = toFiniteNumber(meter.kWH);
      return sum + Math.max(currentValue || 0, currentKwh || 0);
    }, 0);
  const roundedTotalEnergy = roundTo4(totalEnergy) || 0;

  await prismaClient.building.update({
    where: { name: buildingName },
    data: { energy: roundedTotalEnergy }
  });

  return roundedTotalEnergy;
}

async function syncMeterSnapshotAndBuildingEnergy({ snid, timestamp, kW, kWH }, prismaClient = prisma) {
  if (!snid) return null;

  const meter = await prismaClient.meterInfo.findUnique({
    where: { snid },
    select: {
      snid: true,
      buildingName: true,
      type: true,
    }
  });

  if (!meter) return null;

  const nextKwh = roundTo4(kWH);
  const isBattery = String(meter.type || '').toLowerCase().includes('battery');
  const meterData = {
    timestamp,
  };

  if (nextKwh !== null) {
    // Battery: value = accumulated kWh (SoC), clamped to capacity
    if (isBattery) {
      const cap = Number(meter.capacity || 0);
      const clamped = cap > 0 ? Math.min(nextKwh, cap) : nextKwh;
      meterData.value = clamped;
      meterData.kWH = clamped;
    } else {
      meterData.value = roundTo4(kW ?? kWH);
      meterData.kWH = nextKwh;
    }
  }

  await prismaClient.meterInfo.update({
    where: { snid },
    data: meterData
  });

  if (isProduceMeter(meter.type)) {
    await syncBuildingEnergyForBuilding(meter.buildingName, prismaClient);
  }

  // For live meter updates on default prisma client, evaluate auto marketplace posting policy.
  if (prismaClient === prisma) {
    try {
      const { autoPostBatterySurplusOffer } = require('../trading/trade.engine');
      await autoPostBatterySurplusOffer(meter.buildingName);
    } catch (err) {
      console.error('autoPostBatterySurplusOffer error', err);
    }
  }

  return meter;
}

async function aggregateEnergy(log){

  const meterId = log.snid
  const value = roundTo4(log.kWH) || 0

  const t = parseThaiTime(log.timestamp)

  await prisma.$transaction([
    updateHourly(meterId, t, value),
    updateDaily(meterId, t, value),
    updateWeekly(meterId, t, value),
    updateMonthly(meterId, t, value)
  ])

}

function updateHourly(meterId, t, value) {
    const hourCol = `h${t.hour}`

    return prisma.hourlyEnergy.upsert({
        where: {
            meterSnid_date: {
                meterSnid: meterId,
                date: new Date(t.date)
            }
        },
        update: {
              [hourCol]: { increment: value },
              kwh:{increment:value}
        },
        create: {
            meterSnid: meterId,
            date: new Date(t.date),
              ...createHourlyDefaults(),
              [hourCol]: value,
              kwh:value
        }
    })
}

function updateDaily(meterId, t, value){

  const dayCol = `d${t.day}`

  return prisma.dailyEnergy.upsert({
    where:{
      meterSnid_year_month:{
        meterSnid: meterId,
        year:t.year,
        month:t.month
      }
    },
    update:{
          [dayCol]: { increment: value },
          kwh:{increment:value}
    },
    create:{
      meterSnid: meterId,
      year:t.year,
      month:t.month,
          ...createDailyDefaults(),
          [dayCol]: value,
          kwh:value
    }
  })
}

function updateWeekly(meterId, t, value){

  const weekday = ["sun","mon","tue","wed","thu","fri","sat"]
  const weekCol = weekday[t.weekday]

  return prisma.weeklyEnergy.upsert({
    where:{
      meterSnid_year_week:{
        meterSnid: meterId,
        year:t.year,
        week:t.week
      }
    },
    update:{
      [weekCol]: { increment: value },
      kwh:{increment:value}
    },
    create:{
      meterSnid: meterId,
      year:t.year,
      week:t.week,
      ...createWeeklyDefaults(),
      [weekCol]: value,
      kwh:value
    }
  })
}

function updateMonthly(meterId, t, value){

  const monthCol = `M${t.month}`

  return prisma.monthlyEnergy.upsert({
    where:{
      meterSnid_year:{
        meterSnid: meterId,
        year:t.year
      }
    },
    update:{
      [monthCol]: { increment: value },
      kwh:{increment:value}
    },
    create:{
      meterSnid: meterId,
      year:t.year,
      ...createMonthlyDefaults(),
      [monthCol]: value,
      kwh:value
    }
  })
}

function parseTime(ts) {
    const d = new Date(ts)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hour = d.getHours()

    const dateStr = `${year}-${month}-${day}`
    const monthId = `${year}-${String(month).padStart(2,"0")}`
  const weekId = `${year}-${getWeekNumber(d)}`

    return {
        year, month, day, hour, dateStr, monthId, weekId
    }
}

function getWeekNumber(d) {
  // ISO week date weeks start on Monday, week 1 is the week with the first Thursday of the year
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Monday=1, Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function parseThaiTime(ts){

  const inputDate = new Date(ts)
  const bangkokOffsetMs = 7 * 60 * 60 * 1000
  const bangkokDate = new Date(inputDate.getTime() + bangkokOffsetMs)

  const year = bangkokDate.getUTCFullYear()
  const month = bangkokDate.getUTCMonth() + 1
  const day = bangkokDate.getUTCDate()
  const hour = bangkokDate.getUTCHours()
  const weekday = bangkokDate.getUTCDay()
  const week = getWeekNumber(new Date(Date.UTC(year, month - 1, day)))
  return {
    year,
    month,
    day,
    hour,
    week,
    weekday,
    date:new Date(Date.UTC(year, month - 1, day))
  }

}

async function insertRunningMeter(data){

  const timestamp = data?.timestamp instanceof Date ? data.timestamp : new Date(data?.timestamp)
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Invalid timestamp')
  }

  const normalizedKw = data?.kW === undefined || data?.kW === null ? null : roundTo4(data.kW)
  const normalizedKwh = data?.kWH === undefined || data?.kWH === null ? null : roundTo4(data.kWH)
  const source = data?.source || null
  
  let log;
  try {
    log = await prisma.runningMeter.upsert({

    where:{
      snid_timestamp:{
        snid:data.snid,
        timestamp
      }
    },

    update: source ? { source } : {},

    create:{
      snid:data.snid,
      timestamp,
      txid:data?.txid ?? null,
      kW:Number.isFinite(normalizedKw) ? normalizedKw : null,
      kWH:Number.isFinite(normalizedKwh) ? normalizedKwh : null,
      source,
    }

    });
  } catch (err) {
    // Fallback: source column may not exist yet
    if ((err?.message || '').includes('source')) {
      log = await prisma.runningMeter.upsert({
        where: { snid_timestamp: { snid: data.snid, timestamp } },
        update: {},
        create: {
          snid: data.snid, timestamp,
          txid: data?.txid ?? null,
          kW: Number.isFinite(normalizedKw) ? normalizedKw : null,
          kWH: Number.isFinite(normalizedKwh) ? normalizedKwh : null,
        },
      });
    } else {
      throw err;
    }
  }

  await syncMeterSnapshotAndBuildingEnergy({
    snid: data.snid,
    timestamp,
    kW: normalizedKw,
    kWH: normalizedKwh,
  })

  const prev = await prisma.runningMeter.findFirst({
    where:{
      snid:data.snid,
      timestamp:{
        lt:timestamp
      }
    },
    orderBy:{
      timestamp:"desc"
    }
  })

  if(!prev) return

  const current = Number(normalizedKwh)
  const previous = Number(prev.kWH)

  const delta = roundTo4(current - previous) || 0

  if(delta <= 0) return

  await aggregateEnergy({
    snid:data.snid,
    timestamp,
    kWH:delta
  })

  try {
    await invoiceService.syncInvoicesForEnergyLogs([{ timestamp }]);
  } catch (e) {
    console.error('[invoice sync single] failed:', e.message);
  }

  return log
}

async function insertRunningMetersBulk(logs = []) {
  const normalizedLogs = (Array.isArray(logs) ? logs : [])
    .map((item) => {
      const timestamp = item?.timestamp instanceof Date ? item.timestamp : new Date(item?.timestamp);
      if (!item?.snid || Number.isNaN(timestamp.getTime())) return null;

      const normalizedKw = item?.kW === undefined || item?.kW === null ? null : roundTo4(item.kW);
      const normalizedKwh = item?.kWH === undefined || item?.kWH === null ? null : roundTo4(item.kWH);

      return {
        snid: String(item.snid),
        timestamp,
        txid: item?.txid ?? null,
        kW: Number.isFinite(normalizedKw) ? normalizedKw : null,
        kWH: Number.isFinite(normalizedKwh) ? normalizedKwh : null,
        source: item?.source || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.snid !== b.snid) return a.snid.localeCompare(b.snid);
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

  if (!normalizedLogs.length) {
    return { count: 0, inserted: 0, aggregated: 0 };
  }

  const uniqueSnids = [...new Set(normalizedLogs.map((item) => item.snid))];
  const firstTimestampBySnid = new Map();
  const latestLogBySnid = new Map();

  normalizedLogs.forEach((item) => {
    if (!firstTimestampBySnid.has(item.snid)) {
      firstTimestampBySnid.set(item.snid, item.timestamp);
    }
    latestLogBySnid.set(item.snid, item);
  });

  const previousLogs = await Promise.all(
    uniqueSnids.map(async (snid) => {
      const firstTimestamp = firstTimestampBySnid.get(snid);
      const previous = await prisma.runningMeter.findFirst({
        where: {
          snid,
          timestamp: { lt: firstTimestamp }
        },
        orderBy: { timestamp: 'desc' }
      });
      return [snid, previous];
    })
  );

  const previousLogBySnid = new Map(previousLogs);

  // ── Battery SoC from kW (State-of-Charge integration) ──
  // The feed's kWH for a battery is a cumulative energy counter (odometer-style,
  // only ever increases) — NOT a real State of Charge. So it never drops when the
  // battery discharges. Recompute SoC by integrating kW over the time between
  // readings: charge (kW > 0) raises SoC, discharge (kW < 0) lowers it, clamped
  // to [0, capacity]. This overrides item.kWH for battery meters only.
  let batteryMeters = new Map();
  try {
    const batteryRows = await prisma.meterInfo.findMany({
      where: { type: { contains: 'battery', mode: 'insensitive' } },
      select: { snid: true, capacity: true, value: true, kWH: true },
    });
    for (const b of batteryRows) batteryMeters.set(String(b.snid), b);
  } catch (_) {}

  for (const snid of uniqueSnids) {
    const bat = batteryMeters.get(snid);
    if (!bat) continue;
    const capacity = Number(bat.capacity || 0);
    if (!(capacity > 0)) continue; // need a capacity to clamp against

    const rows = normalizedLogs.filter((item) => item.snid === snid);
    if (!rows.length) continue;

    // ── Seed SoC from the battery's REAL energy, not a stale 0 ──
    // Prefer the last known stored energy on MeterInfo (kept in sync by
    // syncMeterSnapshot each batch). If it's zero/missing — e.g. right after a
    // log reset wiped value/kWH to null — fall back to the REAL cumulative kWh
    // carried by the incoming logs (clamped to capacity). That way the battery
    // starts from its true charge instead of being stuck at 0 forever, and kW
    // integration (charge ↑ / discharge ↓) then moves SoC up/down.
    const meterSeed = (Number.isFinite(Number(bat.value)) && Number(bat.value) > 0) ? Number(bat.value)
      : (Number.isFinite(Number(bat.kWH)) && Number(bat.kWH) > 0) ? Number(bat.kWH)
      : NaN;
    const firstLogKwh = Number(rows[0].kWH);
    const prevKwh = Number(previousLogBySnid.get(snid)?.kWH);
    const fallbackSeed = (Number.isFinite(firstLogKwh) && firstLogKwh > 0) ? firstLogKwh
      : (Number.isFinite(prevKwh) && prevKwh > 0) ? prevKwh
      : 0;
    const seedRaw = Number.isFinite(meterSeed) ? meterSeed : fallbackSeed;
    let soc = Math.max(0, Math.min(seedRaw, capacity));

    console.log(`[BATTERY] ${snid} seed=${roundTo4(seedRaw)} cap=${capacity} meterSeed=${roundTo4(meterSeed)} fallback=${roundTo4(fallbackSeed)} rows=${rows.length}`);

    // Integrate from the previous RunningMeter row into the first row of this batch
    const prevRow = previousLogBySnid.get(snid);
    let prevTs = rows[0].timestamp.getTime();
    if (prevRow) {
      const gapH = (prevTs - prevRow.timestamp.getTime()) / 3600000;
      if (gapH > 0 && gapH < 48) {
        soc = Math.max(0, Math.min(soc + Number(rows[0].kW || 0) * gapH, capacity));
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      const ts = item.timestamp.getTime();
      const dtH = (ts - prevTs) / 3600000;
      if (dtH > 0 && dtH < 48) {
        soc = Math.max(0, Math.min(soc + Number(item.kW || 0) * dtH, capacity));
      }
      item.kWH = roundTo4(soc);
      prevTs = ts;
    }
  }

  // ── Idempotency guard: query which (snid, timestamp) pairs already exist ──
  // This prevents double-counting when the same batch is re-processed
  // (e.g. cursor stall → fetch same logs → createMany skipDuplicates → but delta was re-aggregated)
  const minTs = normalizedLogs[0]?.timestamp;
  const maxTs = normalizedLogs[normalizedLogs.length - 1]?.timestamp;
  const existingSet = new Set();
  if (minTs && maxTs) {
    const existingRows = await prisma.runningMeter.findMany({
      where: {
        snid: { in: uniqueSnids },
        timestamp: { gte: minTs, lte: maxTs },
      },
      select: { snid: true, timestamp: true },
    });
    for (const row of existingRows) {
      existingSet.add(`${row.snid}|${row.timestamp.toISOString()}`);
    }
  }

  const deltaLogs = [];

  uniqueSnids.forEach((snid) => {
    const rows = normalizedLogs.filter((item) => item.snid === snid);
    let previousValue = Number(previousLogBySnid.get(snid)?.kWH);

    rows.forEach((item) => {
      const currentValue = Number(item.kWH);
      if (!Number.isFinite(currentValue)) return;
      if (!Number.isFinite(previousValue)) {
        previousValue = currentValue;
        return;
      }

      const delta = roundTo4(currentValue - previousValue) || 0;
      // Always advance previousValue so subsequent entries compute correct delta
      previousValue = currentValue;

      // Skip delta aggregation if this (snid, timestamp) already exists
      // (idempotency guard — prevents double-increment on cursor stall)
      if (existingSet.has(`${item.snid}|${item.timestamp.toISOString()}`)) return;

      if (delta > 0) {
        deltaLogs.push({
          snid: item.snid,
          timestamp: item.timestamp,
          kWH: delta,
        });
      }
    });
  });

  let createResult;
  try {
    createResult = await prisma.runningMeter.createMany({
      data: normalizedLogs.map((item) => ({
        snid: item.snid,
        timestamp: item.timestamp,
        txid: item.txid ?? null,
        kW: item.kW ?? null,
        kWH: item.kWH ?? null,
        source: item.source ?? null,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    // Fallback: source column may not exist yet (before migration)
    if (err?.code === 'P2022' || (err?.message || '').includes('source')) {
      console.warn('[insertRunningMetersBulk] source column unavailable, retrying without source');
      createResult = await prisma.runningMeter.createMany({
        data: normalizedLogs.map((item) => ({
          snid: item.snid,
          timestamp: item.timestamp,
          txid: item.txid ?? null,
          kW: item.kW ?? null,
          kWH: item.kWH ?? null,
        })),
        skipDuplicates: true,
      });
    } else if (err?.code === 'P2003') {
      const invalidSnids = [...new Set(normalizedLogs.map(l => l.snid))];
      throw new Error(`Some meter SNIDs not registered in MeterInfo: ${invalidSnids.slice(0, 5).join(', ')}${invalidSnids.length > 5 ? '...' : ''}. Please register meters first.`);
    } else {
      throw err;
    }
  }

  const hourlyBuckets = new Map();
  const dailyBuckets = new Map();
  const weeklyBuckets = new Map();
  const monthlyBuckets = new Map();

  deltaLogs.forEach((log) => {
    const t = parseThaiTime(log.timestamp);
    const value = roundTo4(log.kWH) || 0;
    if (value <= 0) return;

    const hourlyKey = `${log.snid}|${t.date.toISOString()}`;
    const hourlyBucket = hourlyBuckets.get(hourlyKey) || { meterSnid: log.snid, date: new Date(t.date), kwh: 0 };
    hourlyBucket[`h${t.hour}`] = roundTo4((hourlyBucket[`h${t.hour}`] || 0) + value) || 0;
    hourlyBucket.kwh = roundTo4((hourlyBucket.kwh || 0) + value) || 0;
    hourlyBuckets.set(hourlyKey, hourlyBucket);

    const dailyKey = `${log.snid}|${t.year}|${t.month}`;
    const dailyBucket = dailyBuckets.get(dailyKey) || { meterSnid: log.snid, year: t.year, month: t.month, kwh: 0 };
    dailyBucket[`d${t.day}`] = roundTo4((dailyBucket[`d${t.day}`] || 0) + value) || 0;
    dailyBucket.kwh = roundTo4((dailyBucket.kwh || 0) + value) || 0;
    dailyBuckets.set(dailyKey, dailyBucket);

    const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][t.weekday];
    const weeklyKey = `${log.snid}|${t.year}|${t.week}`;
    const weeklyBucket = weeklyBuckets.get(weeklyKey) || { meterSnid: log.snid, year: t.year, week: t.week, kwh: 0 };
    weeklyBucket[weekday] = roundTo4((weeklyBucket[weekday] || 0) + value) || 0;
    weeklyBucket.kwh = roundTo4((weeklyBucket.kwh || 0) + value) || 0;
    weeklyBuckets.set(weeklyKey, weeklyBucket);

    const monthlyKey = `${log.snid}|${t.year}`;
    const monthlyBucket = monthlyBuckets.get(monthlyKey) || { meterSnid: log.snid, year: t.year, kWH: 0 };
    monthlyBucket[`M${t.month}`] = roundTo4((monthlyBucket[`M${t.month}`] || 0) + value) || 0;
    monthlyBucket.kwh = roundTo4((monthlyBucket.kwh || 0) + value) || 0;
    monthlyBuckets.set(monthlyKey, monthlyBucket);
  });

  const aggregationOps = [];

  hourlyBuckets.forEach((bucket) => {
    const updateData = { kwh: { increment: bucket.kwh || 0 } };
    const createData = { meterSnid: bucket.meterSnid, date: bucket.date, ...createHourlyDefaults(), kwh: bucket.kwh || 0 };
    Object.keys(bucket).forEach((key) => {
      if (/^h([0-9]|1[0-9]|2[0-3])$/.test(key)) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.hourlyEnergy.upsert({
        where: { meterSnid_date: { meterSnid: bucket.meterSnid, date: bucket.date } },
        update: updateData,
        create: createData,
      })
    );
  });

  dailyBuckets.forEach((bucket) => {
    const updateData = { kwh: { increment: bucket.kwh || 0 } };
    const createData = { meterSnid: bucket.meterSnid, year: bucket.year, month: bucket.month, ...createDailyDefaults(), kwh: bucket.kwh || 0 };
    Object.keys(bucket).forEach((key) => {
      if (/^d([1-9]|[12][0-9]|3[01])$/.test(key)) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.dailyEnergy.upsert({
        where: { meterSnid_year_month: { meterSnid: bucket.meterSnid, year: bucket.year, month: bucket.month } },
        update: updateData,
        create: createData,
      })
    );
  });

  weeklyBuckets.forEach((bucket) => {
    const updateData = { kwh: { increment: bucket.kwh || 0 } };
    const createData = { meterSnid: bucket.meterSnid, year: bucket.year, week: bucket.week, ...createWeeklyDefaults(), kwh: bucket.kwh || 0 };
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((key) => {
      if (bucket[key] != null) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.weeklyEnergy.upsert({
        where: { meterSnid_year_week: { meterSnid: bucket.meterSnid, year: bucket.year, week: bucket.week } },
        update: updateData,
        create: createData,
      })
    );
  });

  monthlyBuckets.forEach((bucket) => {
    const updateData = { kwh: { increment: bucket.kwh || 0 } };
    const createData = { meterSnid: bucket.meterSnid, year: bucket.year, ...createMonthlyDefaults(), kwh: bucket.kwh || 0 };
    Object.keys(bucket).forEach((key) => {
      if (/^M([1-9]|1[0-2])$/.test(key)) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.monthlyEnergy.upsert({
        where: { meterSnid_year: { meterSnid: bucket.meterSnid, year: bucket.year } },
        update: updateData,
        create: createData,
      })
    );
  });

  if (aggregationOps.length) {
    await prisma.$transaction(aggregationOps);
  }

  await Promise.all(
    [...latestLogBySnid.values()].map((item) => syncMeterSnapshotAndBuildingEnergy({
      snid: item.snid,
      timestamp: item.timestamp,
      kW: item.kW,
      kWH: item.kWH,
    }))
  );

  try {
    const invResult = await invoiceService.syncInvoicesForEnergyLogs(normalizedLogs);
    console.log('[invoice sync] result:', { periods: invResult?.periods?.length, created: invResult?.createdCount, updated: invResult?.updatedCount });
  } catch (e) {
    console.error('[invoice sync] failed:', e.message);
  }

  return {
    count: normalizedLogs.length,
    inserted: createResult.count || 0,
    aggregated: deltaLogs.length,
  };
}

async function resetEnergyLogs() {
  const result = await prisma.$transaction(async (tx) => {
    const runningMeter = await tx.runningMeter.deleteMany();
    const hourlyEnergy = await tx.hourlyEnergy.deleteMany();
    const dailyEnergy = await tx.dailyEnergy.deleteMany();
    const weeklyEnergy = await tx.weeklyEnergy.deleteMany();
    const monthlyEnergy = await tx.monthlyEnergy.deleteMany();
    await tx.meterInfo.updateMany({
      data: {
        value: null,
        kWH: null,
        timestamp: null,
      }
    });
    await tx.building.updateMany({
      data: {
        energy: 0,
      }
    });

    // Reset the feed cursor too — otherwise the energy feed thinks it already
    // synced past old data and won't re-pull history after a full log reset.
    try {
      if (fs.existsSync(SYNC_CURSOR_FILE)) {
        fs.unlinkSync(SYNC_CURSOR_FILE);
      }
    } catch (_) {}

    return {
      runningMeter: runningMeter.count || 0,
      hourlyEnergy: hourlyEnergy.count || 0,
      dailyEnergy: dailyEnergy.count || 0,
      weeklyEnergy: weeklyEnergy.count || 0,
      monthlyEnergy: monthlyEnergy.count || 0,
      syncCursorReset: true,
    };
  });

  return result;
}

module.exports = {
  insertRunningMeter,
  insertRunningMetersBulk,
  aggregateEnergy,
  resetEnergyLogs,
  syncMeterSnapshotAndBuildingEnergy,
  syncBuildingEnergyForBuilding,
}



