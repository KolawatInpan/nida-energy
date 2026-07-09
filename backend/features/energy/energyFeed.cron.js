/**
 * Energy Feed Cron
 *
 * Fetches meter logs from the external energy data source and feeds them
 * into RunningMeter on the REAL database. The existing aggregation
 * pipeline (insertRunningMetersBulk → aggregateEnergy → syncMeterSnapshot)
 * handles Hourly/Daily/Weekly/Monthly updates automatically.
 *
 * Source Device format:  S-{BUILDING}-{TYPE}-{NUM}  (e.g. S-RAT-PRD-8478)
 *   BUILDING = building code (RAT, AUD, MAL, …)
 *   TYPE     = PRD (producer), CON (consumer), BAT (battery)
 *   NUM      = meter number
 *
 * Smart mapping via ENERGY_FEED_BUILDING_MAP env var:
 *   {"RAT":"ratchaphruek","AUD":"aud","MAL":"malai"}
 * Then looks up MeterInfo by buildingName (ILIKE) + meter type → gets real snid.
 *
 * Env vars:
 *   ENERGY_FEED_URL             — base URL (default: http://10.10.161.239:8089)
 *   ENERGY_FEED_INTERVAL_SEC    — fetch interval in seconds (default: 60)
 *   ENERGY_FEED_ENABLED         — set to 'false' to disable (default: true)
 *   ENERGY_FEED_BUILDING_MAP    — JSON: {"CODE":"building name keyword",…}
 */

const { runWithMode, REAL_MODE } = require('../../utils/prisma');

// ─── Configuration ───────────────────────────────────────────────

const FEED_URL = (process.env.ENERGY_FEED_URL || 'http://10.10.161.239:8089').replace(/\/+$/, '');
const SYNC_INTERVAL_MS = (Number(process.env.ENERGY_FEED_INTERVAL_SEC) || 60) * 1000;
const ENABLED = process.env.ENERGY_FEED_ENABLED !== 'false';

/** Map source type code → MeterInfo.type keyword for ILIKE search */
const TYPE_KEYWORD = {
  PRD: 'produce',
  CON: 'consume',
  BAT: 'battery',
};

/** Load manual device→snid mapping + building map from JSON file */
function loadDeviceMapping() {
  try {
    const data = require('./deviceMapping.json');
    // Return device entries only (skip _buildings meta key)
    const devices = {};
    for (const [k, v] of Object.entries(data)) {
      if (k !== '_buildings') devices[k] = v;
    }
    return devices;
  } catch {
    return {};
  }
}

/** Load building map: file overrides env */
function loadBuildingMap() {
  // Start with env-based map
  let map = {};
  try {
    map = JSON.parse(process.env.ENERGY_FEED_BUILDING_MAP || '{}');
  } catch { /* ignore */ }

  // Merge file-based map (overrides env)
  try {
    const data = require('./deviceMapping.json');
    if (data._buildings) {
      Object.assign(map, data._buildings);
    }
  } catch { /* ignore */ }

  return map;
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Parse source Device ID into parts.
 * "S-RAT-PRD-8478" → { buildingCode: "RAT", typeCode: "PRD", num: "8478" }
 */
function parseDevice(device) {
  const parts = (device || '').split('-');
  if (parts.length < 4 || parts[0] !== 'S') return null;
  return {
    buildingCode: parts[1],
    typeCode: parts[2],
    num: parts[3],
  };
}

/** Format Date to ISO string for time_from param (e.g. "2026-07-03T00:00") */
function toFeedTimeStr(date) {
  return date.toISOString().slice(0, 16);
}

// ─── Device → snid Resolver ──────────────────────────────────────

/**
 * Build a lookup: source Device → real MeterInfo.snid
 * Uses BUILDING_MAP to find building, then matches by meter type.
 */
async function buildDeviceSnidMap(prisma, devices) {
  const map = {};
  const notFound = [];

  // ── Step 0: Load manual device→snid mapping (user-configured) ──
  const manualMap = loadDeviceMapping();
  for (const device of devices) {
    if (manualMap[device]) {
      map[device] = manualMap[device];
    }
  }

  const remainingDevices = devices.filter(d => !map[d]);
  if (remainingDevices.length === 0) return map;

  // ── Step 1: Smart lookup for unmapped devices ──
  const buildingMap = loadBuildingMap();
  const seenBuildings = new Set();
  for (const device of remainingDevices) {
    const parsed = parseDevice(device);
    if (!parsed) continue;
    seenBuildings.add(parsed.buildingCode);
  }

  for (const code of seenBuildings) {
    const nameKeyword = buildingMap[code];
    if (!nameKeyword) {
      // Fallback: strip S- prefix and use as snid directly
      for (const device of devices) {
        if (!map[device] && device.startsWith(`S-${code}-`)) {
          map[device] = device.replace(/^S-/, '');
        }
      }
      continue;
    }

    const buildings = await prisma.building.findMany({
      where: {
        name: { contains: nameKeyword, mode: 'insensitive' },
        OR: [
          { status: null },
          { status: { not: 'INACTIVE' } },
        ],
      },
      select: { name: true },
    });

    if (buildings.length === 0) {
      console.log(`[ENERGY-FEED] Building "${code}" → no match for "${nameKeyword}"`);
      continue;
    }

    for (const building of buildings) {
      const meters = await prisma.meterInfo.findMany({
        where: { buildingName: building.name },
        select: { snid: true, type: true },
      });

      for (const device of devices) {
        if (map[device]) continue;
        const parsed = parseDevice(device);
        if (!parsed || parsed.buildingCode !== code) continue;

        const typeKeyword = TYPE_KEYWORD[parsed.typeCode];
        if (!typeKeyword) continue;

        const matchedMeter = meters.find(m =>
          (m.type || '').toLowerCase().includes(typeKeyword)
        );

        if (matchedMeter) {
          map[device] = matchedMeter.snid;
        }
      }
    }

    for (const device of devices) {
      if (map[device]) continue;
      const parsed = parseDevice(device);
      if (!parsed || parsed.buildingCode !== code) continue;
      notFound.push(device);
    }
  }

  if (notFound.length > 0) {
    console.log(`[ENERGY-FEED] No meter match for: ${notFound.join(', ')}`);
  }

  return map;
}

// ─── Core: Fetch & Feed ──────────────────────────────────────────

async function syncFromEnergyFeed() {
  await runWithMode(REAL_MODE, async () => {
    const { prisma } = require('../../utils/prisma');

    // 1. Find the latest RunningMeter timestamp
    const latestRow = await prisma.runningMeter.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    const timeFrom = latestRow
      ? toFeedTimeStr(new Date(latestRow.timestamp.getTime() + 1000))
      : '2026-01-01T00:00';

    console.log(`[ENERGY-FEED] Fetching logs since ${timeFrom}`);

    // 2. Fetch logs from energy feed source
    let logs;
    try {
      const params = new URLSearchParams({ time_from: timeFrom, limit: '500' });
      const res = await fetch(`${FEED_URL}/meterlog?${params}`);
      if (!res.ok) {
        console.warn(`[ENERGY-FEED] Source returned HTTP ${res.status}`);
        return;
      }
      logs = await res.json();
    } catch (err) {
      console.warn(`[ENERGY-FEED] Failed to reach source: ${err.message}`);
      return;
    }

    if (!Array.isArray(logs) || logs.length === 0) {
      console.log('[ENERGY-FEED] No new logs');
      return;
    }

    console.log(`[ENERGY-FEED] Received ${logs.length} logs`);

    // 3. Build Device → snid mapping
    const devices = [...new Set(logs.map(l => l.Device).filter(Boolean))];
    const snidMap = await buildDeviceSnidMap(prisma, devices);

    if (Object.keys(snidMap).length === 0) {
      console.log('[ENERGY-FEED] No devices mapped to any meter — check ENERGY_FEED_BUILDING_MAP');
      return;
    }

    // 4. Map logs to RunningMeter format
    const mappedLogs = [];
    let skipped = 0;

    for (const log of logs) {
      const snid = snidMap[log.Device];
      if (!snid) { skipped++; continue; }

      const kW = Number(log.kW);
      const kWH = Number(log.kWh);
      if (!Number.isFinite(kW) && !Number.isFinite(kWH)) { skipped++; continue; }

      mappedLogs.push({
        snid,
        timestamp: new Date(log.DataDateTime || log.createAt * 1000),
        kW: Number.isFinite(kW) ? kW : 0,
        kWH: Number.isFinite(kWH) ? kWH : 0,
      });
    }

    if (skipped > 0) {
      console.log(`[ENERGY-FEED] Skipped ${skipped} logs (no meter match or invalid data)`);
    }

    if (mappedLogs.length === 0) return;

    // 5. Feed into RunningMeter
    const { insertRunningMetersBulk } = require('./energyAggregation');
    try {
      const uniqueSnids = [...new Set(mappedLogs.map(l => l.snid))];
      await insertRunningMetersBulk(mappedLogs);
      console.log(`[ENERGY-FEED] ✅ Fed ${mappedLogs.length} logs → ${uniqueSnids.length} meters`);
    } catch (err) {
      console.error(`[ENERGY-FEED] insertRunningMetersBulk failed: ${err.message}`);
    }
  });
}

// ─── Cron Lifecycle ──────────────────────────────────────────────

let syncInterval = null;

function startEnergyFeed() {
  if (!ENABLED) {
    console.log('[ENERGY-FEED] Disabled (ENERGY_FEED_ENABLED=false)');
    return;
  }

  const buildingMap = loadBuildingMap();
  const mapKeys = Object.keys(buildingMap);
  console.log(`[ENERGY-FEED] Starting every ${SYNC_INTERVAL_MS / 1000}s → ${FEED_URL}`);
  if (mapKeys.length > 0) {
    console.log(`[ENERGY-FEED] Building map: ${mapKeys.map(k => `${k}→"${buildingMap[k]}"`).join(', ')}`);
  } else {
    console.log('[ENERGY-FEED] No building map set — will try exact S- strip match');
  }

  syncFromEnergyFeed().catch(err => console.error('[ENERGY-FEED] Initial sync error:', err.message));

  syncInterval = setInterval(() => {
    syncFromEnergyFeed().catch(err => console.error('[ENERGY-FEED] Sync error:', err.message));
  }, SYNC_INTERVAL_MS);
}

function stopEnergyFeed() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[ENERGY-FEED] Stopped');
  }
}

module.exports = { startEnergyFeed, stopEnergyFeed, syncFromEnergyFeed };
