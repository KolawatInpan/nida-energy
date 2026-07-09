const cron = require('node-cron');
const { prisma, getPrismaForMode, runWithMode, REAL_MODE, DEMO_MODE } = require('../../utils/prisma');

/**
 * Modes to run mock energy generation on.
 * Default: DEMO only (real DB is fed by API pipeline).
 * Set MOCK_REAL_DB=true in .env to also run on real DB.
 */
const ALL_MODES = process.env.MOCK_REAL_DB === 'true'
  ? [REAL_MODE, DEMO_MODE]
  : [DEMO_MODE];

/**
 * Run an async function against configured databases sequentially.
 */
async function runForBothModes(fn) {
  for (const mode of ALL_MODES) {
    console.log(`[MOCK] === Running for ${mode.toUpperCase()} database ===`);
    try {
      await runWithMode(mode, fn);
    } catch (err) {
      console.error(`[MOCK] Error in ${mode} mode:`, err.message);
    }
  }
}

// ─── Startup Backfill ───────────────────────────────────────────

async function backfillOnStartup() {
  await runForBothModes(async () => {
    const meters = await prisma.meterInfo.findMany({
      select: { snid: true, kWH: true, type: true, capacity: true, buildingName: true }
    });

    if (!meters.length) {
      console.log('[BACKFILL] No meters registered — skipping');
      return;
    }

    const now = new Date();
    now.setMinutes(0, 0, 0);
    const epochStart = new Date('2026-01-01T00:00:00');

    const latestRecords = await prisma.$queryRawUnsafe(`
      SELECT snid, MAX(timestamp) as latest
      FROM "RunningMeter"
      WHERE snid IN (${meters.map(m => `'${m.snid}'`).join(',')})
      GROUP BY snid
    `);

    const latestMap = {};
    (latestRecords || []).forEach(r => {
      latestMap[r.snid] = new Date(r.latest);
    });

    const totalExisting = Object.values(latestMap).length;
    console.log(`[BACKFILL] ${totalExisting}/${meters.length} meters have data in RunningMeter`);

    const BATCH_SIZE = 500;
    let totalInserts = 0;

    for (const meter of meters) {
      const snid = meter.snid;
      const latest = latestMap[snid];

      let startDate;
      let startingKwh;

      if (latest) {
        startDate = new Date(latest.getTime() + 60 * 60 * 1000);
        const lastRow = await prisma.runningMeter.findFirst({
          where: { snid, timestamp: latest },
          select: { kWH: true }
        });
        startingKwh = Number(lastRow?.kWH || meter.kWH || 0);
        // Clamp to capacity (old data may overflow)
        const cap = Number(meter.capacity || 0);
        if (cap > 0 && startingKwh > cap) {
          console.log(`[BACKFILL] Clamping ${snid} starting kWh: ${startingKwh} → ${cap}`);
          startingKwh = cap;
        }

        if (startDate >= now) {
          console.log(`[BACKFILL] ${snid}: up to date (latest: ${latest.toISOString()})`);
          continue;
        }
      } else {
        startDate = new Date(epochStart);
        startingKwh = Number(meter.kWH || 0);
        const cap2 = Number(meter.capacity || 0);
        if (cap2 > 0 && startingKwh > cap2) startingKwh = cap2;
      }

      const gapHours = Math.ceil((now - startDate) / (60 * 60 * 1000));
      console.log(`[BACKFILL] ${snid}: filling ${gapHours}h gap from ${startDate.toISOString()} to ${now.toISOString()}`);

      let cursor = new Date(startDate);
      let runningTotal = startingKwh;
      const logs = [];
      let completed = 0;

      while (cursor < now) {
        // Type-aware energy generation
        const meterTypeLoop = (meter.type || '').toLowerCase();
        const isProducer = meterTypeLoop === 'producer' || meterTypeLoop === 'produce';
        const isBattery = meterTypeLoop === 'battery';
        const capacity = Number(meter.capacity || 0);
        const hour = cursor.getHours();

        let kW;
        if (isBattery && capacity > 0) {
          // Battery: charge 6am-6pm (solar), discharge 6pm-6am (building load)
          const inDaylight = hour >= 6 && hour < 18;
          if (inDaylight) {
            const noonAngle = ((hour - 6) / 12) * Math.PI;
            const solarFactor = Math.sin(noonAngle);
            const base = capacity * 0.15 * solarFactor;
            const noise = (Math.random() - 0.5) * Math.max(0.02, base * 0.15);
            kW = Math.max(0, +(base + noise).toFixed(4));
          } else {
            // Night discharge: ~10% of capacity per hour
            const dischargeBase = capacity * 0.08;
            const noise = (Math.random() - 0.5) * dischargeBase * 0.2;
            kW = -Math.max(0, +(dischargeBase + noise).toFixed(4));
          }
          // Cap/floor: kWh stays within [0, capacity]
          const nextTotal = runningTotal + kW;
          if (nextTotal > capacity) kW = Math.max(0, capacity - runningTotal);
          if (nextTotal < 0) kW = Math.min(0, -runningTotal);
        } else if (isProducer && capacity > 0) {
          // Solar: daylight-only 6am-6pm, half-sine ramp
          const inDaylight = hour >= 6 && hour < 18;
          if (inDaylight) {
            const noonAngle = ((hour - 6) / 12) * Math.PI;
            const solarFactor = Math.sin(noonAngle);
            const base = capacity * 0.5 * solarFactor;
            const noise = (Math.random() - 0.5) * Math.max(0.05, base * 0.15);
            kW = Math.max(0, +(base + noise).toFixed(4));
          } else {
            kW = 0;
          }
        } else {
          // Consumer: large buildings ~100-200 kWh/day, small buildings ~50-70 kWh/day
          const largeBuildings = ['Ratchaphruek', 'Malai', 'Auditorium'];
          const isLarge = largeBuildings.includes(meter.buildingName);
          const minVal = isLarge ? 1 : 0.5;
          const maxVal = isLarge ? 12 : 5;
          const phase = 9;          // peak at 3pm (phase+6=15)
          const angle = ((hour - phase) / 24) * 2 * Math.PI;
          const amplitude = (maxVal - minVal) / 2;
          const mid = (maxVal + minVal) / 2;
          const base = mid + amplitude * Math.sin(angle);
          const noise = (Math.random() - 0.5) * Math.max(0.05, amplitude * 0.1);
          kW = Math.max(minVal, +(base + noise).toFixed(4));
        }
        runningTotal = +(runningTotal + kW).toFixed(4);

        // Determine source tag for battery charge tracking
        let source = null;
        if (isBattery && kW > 0) source = 'SOLAR';
        else if (isProducer && kW > 0) source = 'SOLAR';

        logs.push({
          snid,
          timestamp: cursor.toISOString(),
          kW,
          kWH: runningTotal,
          source,
        });

        if (logs.length >= BATCH_SIZE) {
          const batch = logs.splice(0);
          const { insertRunningMetersBulk } = require('./energyAggregation');
          await insertRunningMetersBulk(batch);
          completed += batch.length;
        }

        cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
      }

      if (logs.length > 0) {
        const { insertRunningMetersBulk } = require('./energyAggregation');
        await insertRunningMetersBulk(logs);
        completed += logs.length;
      }

      totalInserts += completed;
      console.log(`[BACKFILL] ${snid}: ${completed} records inserted`);
    }

    if (totalInserts > 0) {
      console.log(`[BACKFILL] Total ${totalInserts} records inserted`);

      // Full energy aggregation: RunningMeter → Hourly/Daily/Weekly/Monthly
      console.log('[BACKFILL] Running full energy aggregation for all meters');
      const { aggregateEnergy } = require('./energyAggregation');
      const allMeters = await prisma.meterInfo.findMany({ select: { snid: true } });
      let aggCount = 0;
      for (const m of allMeters) {
        try {
          const records = await prisma.runningMeter.findMany({
            where: { snid: m.snid },
            orderBy: { timestamp: 'asc' },
            select: { snid: true, timestamp: true, kWH: true }
          });
          if (records.length < 2) continue;
          for (let i = 1; i < records.length; i++) {
            const delta = +(records[i].kWH - records[i - 1].kWH).toFixed(4);
            if (delta <= 0) continue;
            await aggregateEnergy({
              snid: records[i].snid,
              timestamp: records[i].timestamp,
              kWH: delta
            });
            aggCount++;
          }
          console.log(`[BACKFILL] Aggregated ${records.length} records → ${aggCount} deltas for ${m.snid}`);
        } catch (e) {
          console.warn(`[BACKFILL] aggregateEnergy failed for ${m.snid}:`, e.message);
        }
      }
      console.log(`[BACKFILL] Aggregation complete! (${aggCount} total deltas processed)`);

      // Sync MeterInfo snapshots
      console.log('[BACKFILL] Syncing MeterInfo snapshots from RunningMeter');
      const { syncMeterSnapshotAndBuildingEnergy } = require('./energyAggregation');
      for (const m of allMeters) {
        try {
          const latest = await prisma.runningMeter.findFirst({
            where: { snid: m.snid },
            orderBy: { timestamp: 'desc' },
            select: { snid: true, timestamp: true, kW: true, kWH: true }
          });
          if (latest) {
            await syncMeterSnapshotAndBuildingEnergy(latest);
            console.log(`[BACKFILL] Synced MeterInfo for ${m.snid} → ${latest.kWH} kWh at ${latest.timestamp}`);
          }
        } catch (e) {
          console.warn(`[BACKFILL] syncMeterSnapshot failed for ${m.snid}:`, e.message);
        }
      }
      console.log('[BACKFILL] MeterInfo sync complete!');
    } else {
      console.log('[BACKFILL] All meters up to date — nothing to fill (skipping aggregation)');
    }

    // Enable auto-mock on all meters
    console.log('[BACKFILL] Enabling isAutoMock on all meters for continuous generation');
    await prisma.meterInfo.updateMany({
      data: { isAutoMock: true }
    });
    console.log('[BACKFILL] All meters set to isAutoMock=true');
  });
}

// ─── Hourly Cron ────────────────────────────────────────────────

function initMockEnergyCron() {
  const scheduleExpr = process.env.MOCK_ENERGY_CRON || '0 * * * *';
  console.log('[CRON] Mock Energy schedule:', scheduleExpr);

  cron.schedule(scheduleExpr, async () => {
    console.log('[CRON] ========================================');
    console.log('[CRON] Executing Auto Mock Energy Generator');
    console.log('[CRON] ========================================');

    await runForBothModes(async () => {
      const activeMeters = await prisma.meterInfo.findMany({
        where: { isAutoMock: true },
        select: { snid: true, type: true, capacity: true, kWH: true, buildingName: true, mockProfile: true },
      });

      if (activeMeters.length === 0) {
        console.log('[CRON] No meters with isAutoMock=true — skipping');
        return;
      }

      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      start.setHours(start.getHours() - 1);
      start.setMinutes(0, 0, 0);
      end.setMinutes(0, 0, 0);

      // Phase 1: Inject energy data into RunningMeter via internal API call
      const PORT = process.env.PORT || 8000;
      const currentMode = require('../../utils/prisma').getCurrentMode();

      for (const meter of activeMeters) {
        try {
          const meterType = (meter.type || '').toLowerCase();
          const isBattery = meterType === 'battery';
          const isProducer = meterType === 'producer' || meterType === 'produce';
          const capacity = Number(meter.capacity || 0);

          // Battery: direct charge/discharge entry (needs negative kW, not supported by profiles)
          if (isBattery && capacity > 0) {
            const hour = start.getHours();
            const inDaylight = hour >= 6 && hour < 18;
            let kW;
            if (inDaylight) {
              const noonAngle = ((hour - 6) / 12) * Math.PI;
              const base = capacity * 0.15 * Math.sin(noonAngle);
              const noise = (Math.random() - 0.5) * Math.max(0.02, base * 0.15);
              kW = Math.max(0, +(base + noise).toFixed(4));
            } else {
              const dischargeBase = capacity * 0.08;
              const noise = (Math.random() - 0.5) * dischargeBase * 0.2;
              kW = -Math.max(0, +(dischargeBase + noise).toFixed(4));
            }
            const currentKwh = Number(meter.kWH || 0);
            let nextKwh = currentKwh + kW;
            if (nextKwh > capacity) { nextKwh = capacity; kW = capacity - currentKwh; }
            if (nextKwh < 0) { nextKwh = 0; kW = -currentKwh; }

            const { insertRunningMeter } = require('../energy/energyAggregation');
            const chargeSource = kW > 0 ? 'SOLAR' : null;
            await insertRunningMeter({ snid: meter.snid, timestamp: end, kW, kWH: nextKwh, source: chargeSource });
            console.log(`[CRON] Battery ${meter.snid}: ${kW > 0 ? '+' : ''}${kW.toFixed(2)} kW → ${nextKwh.toFixed(1)}/${capacity.toFixed(0)} kWh [${currentMode}]`);
            continue;
          }

          // Build type-aware profile params so mock matches physical reality
          let valueProfile = meter.mockProfile || 'sinusoidal';
          let profileParams;
          if (isProducer && capacity > 0) {
            // Solar: daylight-only (6am-6pm), ~50% of rated capacity avg (ramp-up/down)
            valueProfile = 'peak';
            profileParams = { off: 0, peak: capacity * 0.5, startPeakHour: 6, endPeakHour: 18 };
          } else {
            // Consumer: large buildings ~100-200 kWh/day, small buildings ~50-70 kWh/day
            const largeBuildings = ['Ratchaphruek', 'Malai', 'Auditorium'];
            const isLarge = largeBuildings.includes(meter.buildingName);
            profileParams = isLarge
              ? { min: 1, max: 12, phaseShiftHours: 15 }   // ~130-160 kWh/day
              : { min: 0.5, max: 5, phaseShiftHours: 15 };  // ~55-70 kWh/day
          }

          const payload = {
            snid: meter.snid,
            start: start.toISOString(),
            end: end.toISOString(),
            intervalHours: 1,
            valueProfile: meter.mockProfile || 'sinusoidal',
            profileParams,
            startingKwh: meter.kWH ? Number(meter.kWH) : 0,
          };

          const response = await fetch(`http://localhost:${PORT}/api/runningMeters/generate-hourly`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-data-mode': currentMode,
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            console.log(`[CRON] Mocked 1h for ${meter.snid} [${currentMode}]`);
          } else {
            console.warn(`[CRON] generate-hourly failed for ${meter.snid}: HTTP ${response.status}`);
          }
        } catch (err) {
          console.error(`[CRON] Error mocking ${meter.snid}:`, err.message);
        }
      }

      // Phase 2: Sync energy + auto-trade
      const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');
      const { autoExecuteTradingForBuilding } = require('../trading/trade.engine');

      const buildingNames = [...new Set(activeMeters.map(m => m.buildingName).filter(Boolean))];

      for (const bName of buildingNames) {
        try {
          await syncBuildingEnergyForBuilding(bName);
          console.log(`[CRON] Synced energy for ${bName} [${currentMode}]`);

          const building = await prisma.building.findUnique({ where: { name: bName } });
          if (!building) continue;

          const batteryMeter = await prisma.meterInfo.findFirst({
            where: { buildingName: bName, type: { contains: 'battery', mode: 'insensitive' } },
            select: { kWH: true, capacity: true },
          });

          if (!batteryMeter || !batteryMeter.capacity) {
            console.log(`[CRON] ${bName}: no battery meter, skipping auto-trade`);
            continue;
          }

          const currentKwh = Number(batteryMeter.kWH || 0);
          const capacity = Number(batteryMeter.capacity || 0);
          const thresholdPct = Number(building.batterySellThreshold != null ? building.batterySellThreshold : 80);
          const thresholdKwh = (capacity * thresholdPct) / 100;
          const batteryPct = capacity > 0 ? Math.round((currentKwh / capacity) * 100) : 0;

          const tradeMode = String(building.tradeMode || building.batteryTradeMode || 'MANUAL').toUpperCase();
          const shouldAutoTrade = tradeMode === 'AUTO_BATTERY_THRESHOLD' || tradeMode === 'AUTO_TRADE';

          console.log(`[CRON] ${bName}: battery ${currentKwh.toFixed(1)}/${capacity.toFixed(0)} kWh (${batteryPct}%), threshold ${thresholdPct}% (${thresholdKwh.toFixed(0)} kWh), mode: ${tradeMode}`);

          if (shouldAutoTrade && currentKwh > thresholdKwh) {
            const excess = currentKwh - thresholdKwh;
            console.log(`[CRON] ${bName}: battery ABOVE threshold (excess: ${excess.toFixed(1)} kWh) → triggering auto-trade`);
            const result = await autoExecuteTradingForBuilding(bName);
            console.log(`[CRON] ${bName} auto-trade result:`, JSON.stringify(result));
          } else if (!shouldAutoTrade) {
            console.log(`[CRON] ${bName}: manual mode, skipping auto-trade`);
          } else {
            console.log(`[CRON] ${bName}: battery below threshold (${currentKwh.toFixed(1)} < ${thresholdKwh.toFixed(0)}), no sell`);
          }
        } catch (err) {
          console.error(`[CRON] Error in threshold check for ${bName}:`, err.message);
        }
      }
    });

    console.log('[CRON] ========================================');
    console.log('[CRON] Mock Energy cycle complete for all databases');
    console.log('[CRON] ========================================');
  });

  console.log('[SYSTEM] Mock Energy Cron Job initialized (dual-database: real + demo).');
}

module.exports = { initMockEnergyCron, backfillOnStartup };
