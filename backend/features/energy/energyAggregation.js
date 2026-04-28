const { prisma } = require('../../utils/prisma');
const invoiceService = require('../billing/invoice.service');

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

  const nextValue = roundTo4(kWH);
  const meterData = {
    timestamp,
  };

  if (nextValue !== null) {
    meterData.value = nextValue;
    meterData.kWH = nextValue;
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
      const OfferModel = require('../trading/offer.model');
      await OfferModel.autoPostBatterySurplusOffer(meter.buildingName);
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
            meterId_date: {
                meterId,
                date: new Date(t.date)
            }
        },
        update: {
              [hourCol]: { increment: value },
              kWH:{increment:value}
        },
        create: {
            meterId,
            date: new Date(t.date),
              ...createHourlyDefaults(),
              [hourCol]: value,
              kWH:value
        }
    })
}

function updateDaily(meterId, t, value){

  const dayCol = `d${t.day}`

  return prisma.dailyEnergy.upsert({
    where:{
      meterId_year_month:{
        meterId,
        year:t.year,
        month:t.month
      }
    },
    update:{
          [dayCol]: { increment: value },
          kWH:{increment:value}
    },
    create:{
      meterId,
      year:t.year,
      month:t.month,
          ...createDailyDefaults(),
          [dayCol]: value,
          kWH:value
    }
  })
}

function updateWeekly(meterId, t, value){

  const weekday = ["sun","mon","tue","wed","thu","fri","sat"]
  const weekCol = weekday[t.weekday]

  return prisma.weeklyEnergy.upsert({
    where:{
      meterId_year_week:{
        meterId,
        year:t.year,
        week:t.week
      }
    },
    update:{
      [weekCol]: { increment: value },
      kWH:{increment:value}
    },
    create:{
      meterId,
      year:t.year,
      week:t.week,
      ...createWeeklyDefaults(),
      [weekCol]: value,
      kWH:value
    }
  })
}

function updateMonthly(meterId, t, value){

  const monthCol = `M${t.month}`

  return prisma.monthlyEnergy.upsert({
    where:{
      meterId_year:{
        meterId,
        year:t.year
      }
    },
    update:{
      [monthCol]: { increment: value },
      kWH:{increment:value}
    },
    create:{
      meterId,
      year:t.year,
      ...createMonthlyDefaults(),
      [monthCol]: value,
      kWH:value
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
  
  const log = await prisma.runningMeter.upsert({

    where:{
      snid_timestamp:{
        snid:data.snid,
        timestamp
      }
    },

    update:{},

    create:{
      snid:data.snid,
      timestamp,
      txid:data?.txid ?? null,
      kW:Number.isFinite(normalizedKw) ? normalizedKw : null,
      kWH:Number.isFinite(normalizedKwh) ? normalizedKwh : null
    }

  })

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

  await invoiceService.syncInvoicesForEnergyLogs([{ timestamp }]);

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
      previousValue = currentValue;

      if (delta > 0) {
        deltaLogs.push({
          snid: item.snid,
          timestamp: item.timestamp,
          kWH: delta,
        });
      }
    });
  });

  const createResult = await prisma.runningMeter.createMany({
    data: normalizedLogs.map((item) => ({
      snid: item.snid,
      timestamp: item.timestamp,
      txid: item.txid,
      kW: item.kW,
      kWH: item.kWH,
    })),
    skipDuplicates: true,
  });

  const hourlyBuckets = new Map();
  const dailyBuckets = new Map();
  const weeklyBuckets = new Map();
  const monthlyBuckets = new Map();

  deltaLogs.forEach((log) => {
    const t = parseThaiTime(log.timestamp);
    const value = roundTo4(log.kWH) || 0;
    if (value <= 0) return;

    const hourlyKey = `${log.snid}|${t.date.toISOString()}`;
    const hourlyBucket = hourlyBuckets.get(hourlyKey) || { meterId: log.snid, date: new Date(t.date), kWH: 0 };
    hourlyBucket[`h${t.hour}`] = roundTo4((hourlyBucket[`h${t.hour}`] || 0) + value) || 0;
    hourlyBucket.kWH = roundTo4((hourlyBucket.kWH || 0) + value) || 0;
    hourlyBuckets.set(hourlyKey, hourlyBucket);

    const dailyKey = `${log.snid}|${t.year}|${t.month}`;
    const dailyBucket = dailyBuckets.get(dailyKey) || { meterId: log.snid, year: t.year, month: t.month, kWH: 0 };
    dailyBucket[`d${t.day}`] = roundTo4((dailyBucket[`d${t.day}`] || 0) + value) || 0;
    dailyBucket.kWH = roundTo4((dailyBucket.kWH || 0) + value) || 0;
    dailyBuckets.set(dailyKey, dailyBucket);

    const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][t.weekday];
    const weeklyKey = `${log.snid}|${t.year}|${t.week}`;
    const weeklyBucket = weeklyBuckets.get(weeklyKey) || { meterId: log.snid, year: t.year, week: t.week, kWH: 0 };
    weeklyBucket[weekday] = roundTo4((weeklyBucket[weekday] || 0) + value) || 0;
    weeklyBucket.kWH = roundTo4((weeklyBucket.kWH || 0) + value) || 0;
    weeklyBuckets.set(weeklyKey, weeklyBucket);

    const monthlyKey = `${log.snid}|${t.year}`;
    const monthlyBucket = monthlyBuckets.get(monthlyKey) || { meterId: log.snid, year: t.year, kWH: 0 };
    monthlyBucket[`M${t.month}`] = roundTo4((monthlyBucket[`M${t.month}`] || 0) + value) || 0;
    monthlyBucket.kWH = roundTo4((monthlyBucket.kWH || 0) + value) || 0;
    monthlyBuckets.set(monthlyKey, monthlyBucket);
  });

  const aggregationOps = [];

  hourlyBuckets.forEach((bucket) => {
    const updateData = { kWH: { increment: bucket.kWH || 0 } };
    const createData = { meterId: bucket.meterId, date: bucket.date, ...createHourlyDefaults(), kWH: bucket.kWH || 0 };
    Object.keys(bucket).forEach((key) => {
      if (/^h([0-9]|1[0-9]|2[0-3])$/.test(key)) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.hourlyEnergy.upsert({
        where: { meterId_date: { meterId: bucket.meterId, date: bucket.date } },
        update: updateData,
        create: createData,
      })
    );
  });

  dailyBuckets.forEach((bucket) => {
    const updateData = { kWH: { increment: bucket.kWH || 0 } };
    const createData = { meterId: bucket.meterId, year: bucket.year, month: bucket.month, ...createDailyDefaults(), kWH: bucket.kWH || 0 };
    Object.keys(bucket).forEach((key) => {
      if (/^d([1-9]|[12][0-9]|3[01])$/.test(key)) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.dailyEnergy.upsert({
        where: { meterId_year_month: { meterId: bucket.meterId, year: bucket.year, month: bucket.month } },
        update: updateData,
        create: createData,
      })
    );
  });

  weeklyBuckets.forEach((bucket) => {
    const updateData = { kWH: { increment: bucket.kWH || 0 } };
    const createData = { meterId: bucket.meterId, year: bucket.year, week: bucket.week, ...createWeeklyDefaults(), kWH: bucket.kWH || 0 };
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((key) => {
      if (bucket[key] != null) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.weeklyEnergy.upsert({
        where: { meterId_year_week: { meterId: bucket.meterId, year: bucket.year, week: bucket.week } },
        update: updateData,
        create: createData,
      })
    );
  });

  monthlyBuckets.forEach((bucket) => {
    const updateData = { kWH: { increment: bucket.kWH || 0 } };
    const createData = { meterId: bucket.meterId, year: bucket.year, ...createMonthlyDefaults(), kWH: bucket.kWH || 0 };
    Object.keys(bucket).forEach((key) => {
      if (/^M([1-9]|1[0-2])$/.test(key)) {
        updateData[key] = { increment: bucket[key] || 0 };
        createData[key] = bucket[key] || 0;
      }
    });
    aggregationOps.push(
      prisma.monthlyEnergy.upsert({
        where: { meterId_year: { meterId: bucket.meterId, year: bucket.year } },
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

  await invoiceService.syncInvoicesForEnergyLogs(normalizedLogs);

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

    return {
      runningMeter: runningMeter.count || 0,
      hourlyEnergy: hourlyEnergy.count || 0,
      dailyEnergy: dailyEnergy.count || 0,
      weeklyEnergy: weeklyEnergy.count || 0,
      monthlyEnergy: monthlyEnergy.count || 0,
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



