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
const SYNC_INTERVAL_MS = (Number(process.env.ENERGY_FEED_INTERVAL_SEC) || 10) * 1000;
const ENABLED = process.env.ENERGY_FEED_ENABLED !== 'false';
const CURSOR_FILE = require('path').join(__dirname, 'syncCursor.txt');

/** Map source type code → MeterInfo.type keyword for ILIKE search */
const TYPE_KEYWORD = {
  PRD: 'produce',
  CON: 'consume',
  BAT: 'battery',
};

/** Load manual device→snid mapping + building map from JSON file */
function loadDeviceMapping() {
  try {
    const raw = require('fs').readFileSync(require('path').join(__dirname, 'deviceMapping.json'), 'utf-8');
    const data = JSON.parse(raw);
    const devices = {};
    for (const [k, v] of Object.entries(data)) {
      if (k !== '_buildings') devices[k] = v;
    }
    return devices;
  } catch (e) {
    console.error('[ENERGY-FEED] loadDeviceMapping failed:', e.message, e.stack?.split('\n')[0]);
    return {};
  }
}

/** Load building map: file overrides env */
function loadBuildingMap() {
  let map = {};
  try {
    map = JSON.parse(process.env.ENERGY_FEED_BUILDING_MAP || '{}');
  } catch { /* ignore */ }

  try {
    const raw = require('fs').readFileSync(require('path').join(__dirname, 'deviceMapping.json'), 'utf-8');
    const data = JSON.parse(raw);
    if (data._buildings) Object.assign(map, data._buildings);
  } catch (e) {
    console.error('[ENERGY-FEED] loadBuildingMap failed:', e.message);
  }

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

/**
 * Persist the newest DataDateTime seen to the cursor file.
 * The file is the single source of truth for the sync cursor — it is written
 * after EVERY batch (success or skip) so the sync always resumes exactly where
 * it left off. Deleting the file restarts the sync from the beginning.
 *
 * NOTE: we advance +1ms past the newest log. JS Date only keeps millisecond
 * precision, so `new Date(...).toISOString()` truncates sub-ms fractions. If we
 * stored the raw truncated value, the next `time_from >= cursor` fetch would
 * re-match the exact same log and loop forever, repeatedly re-integrating it
 * (which makes battery SoC drift). +1ms guarantees we never re-fetch a seen log.
 */
function persistCursor(logs) {
  try {
    const last = logs[logs.length - 1];
    const lastDateTime = last.DataDateTime || new Date((last.createAt || 0) * 1000).toISOString();
    const cursorMs = new Date(lastDateTime).getTime() + 1;
    require('fs').writeFileSync(CURSOR_FILE, new Date(cursorMs).toISOString(), 'utf-8');
  } catch (_) {}
}

// ─── Device → snid Resolver ──────────────────────────────────────

/**
 * Build a lookup: source Device → real MeterInfo.snid
 * Uses BUILDING_MAP to find building, then matches by meter type.
 */
async function buildDeviceSnidMap(prisma, devices) {
  const map = {};

  // ── Manual device→snid mapping ONLY (user-configured via Meter Pairing) ──
  const manualMap = loadDeviceMapping();
  console.log(`[ENERGY-FEED] loadDeviceMapping returned ${Object.keys(manualMap).length} entries`);
  for (const device of devices) {
    if (manualMap[device]) {
      map[device] = manualMap[device];
    }
  }

  console.log(`[ENERGY-FEED] Matched ${Object.keys(map).length} of ${devices.length} devices`);

  const unmapped = devices.filter(d => !map[d]);
  if (unmapped.length > 0) {
    console.log(`[ENERGY-FEED] Unmapped devices (pair manually in API Status → Meter Pairing): ${unmapped.join(', ')}`);
  }

  return map;
}

// ─── Core: Fetch & Feed ──────────────────────────────────────────

async function syncFromEnergyFeed() {
  await runWithMode(REAL_MODE, async () => {
    const { prisma } = require('../../utils/prisma');

    // 1. Resolve cursor — syncCursor.txt is the single source of truth.
    //    Falls back to latest RunningMeter (legacy), then start of data.
    let timeFrom;
    try {
      const cursor = require('fs').readFileSync(CURSOR_FILE, 'utf-8').trim();
      if (cursor) timeFrom = cursor;
    } catch (_) {}
    if (!timeFrom) {
      const latestRow = await prisma.runningMeter.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      if (latestRow) {
        timeFrom = toFeedTimeStr(new Date(latestRow.timestamp.getTime() + 1000));
      } else {
        timeFrom = '2026-01-01T00:00';
      }
    }

    console.log(`[ENERGY-FEED] Fetching logs since ${timeFrom}`);

    // 2. Fetch logs from energy feed source
    let logs;
    try {
      const params = new URLSearchParams({ time_from: timeFrom, limit: '1000' });
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
      // Advance cursor past these unmapped logs so next sync skips them
      persistCursor(logs);
      console.log(`[ENERGY-FEED] Skipping ahead — all ${logs.length} logs from ${timeFrom} are unmapped`);
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

    if (mappedLogs.length === 0) {
      // No valid mapped logs this batch — still advance so we don't loop
      persistCursor(logs);
      return;
    }

    // 5. Feed into RunningMeter (includes syncMeterSnapshotAndBuildingEnergy for latest per snid)
    const { insertRunningMetersBulk } = require('./energyAggregation');
    try {
      const uniqueSnids = [...new Set(mappedLogs.map(l => l.snid))];
      await insertRunningMetersBulk(mappedLogs);
      // Advance cursor to newest DataDateTime of the batch (success = all seen)
      persistCursor(logs);
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

/**
 * Get current sync status — latest cursor date and file-based fallback.
 */
async function getSyncStatus() {
  const { prisma } = require('../../utils/prisma');
  const latestRow = await prisma.runningMeter.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  let fileCursor = null;
  try {
    const fs = require('fs');
    const path = require('path');
    fileCursor = fs.readFileSync(path.join(__dirname, 'syncCursor.txt'), 'utf-8').trim();
  } catch (_) {}

  const totalRows = await prisma.runningMeter.count();

  return {
    latestRunningMeter: latestRow?.timestamp?.toISOString() || null,
    fileCursor: fileCursor || null,
    totalRunningMeterRows: totalRows,
    syncIntervalSec: SYNC_INTERVAL_MS / 1000,
    feedUrl: FEED_URL,
    enabled: ENABLED,
  };
}

module.exports = { startEnergyFeed, stopEnergyFeed, syncFromEnergyFeed, getSyncStatus };
