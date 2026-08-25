/**
 * Energy Feed Routes
 * Manual trigger endpoint for the energy feed sync.
 * Device mapping CRUD for manual meter pairing.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const asyncHandler = require('../../middleware/asyncHandler');

const MAPPING_PATH = path.join(__dirname, 'deviceMapping.json');

function readMapping() {
  try {
    return JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeMapping(data) {
  fs.writeFileSync(MAPPING_PATH, JSON.stringify(data, null, 2), 'utf-8');
  // Bust require cache so cron picks up changes immediately
  delete require.cache[require.resolve(MAPPING_PATH)];
}

/** POST /api/energy-feed/sync — manually trigger a sync cycle */
router.post('/sync', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const result = { logs: [] };

  // Override console.log temporarily to capture sync logs
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    result.logs.push({ level: 'info', message: args.join(' '), time: Date.now() - startTime });
    originalLog(...args);
  };
  console.warn = (...args) => {
    result.logs.push({ level: 'warn', message: args.join(' '), time: Date.now() - startTime });
    originalWarn(...args);
  };
  console.error = (...args) => {
    result.logs.push({ level: 'error', message: args.join(' '), time: Date.now() - startTime });
    originalError(...args);
  };

  try {
    const { syncFromEnergyFeed } = require('./energyFeed.cron');
    await syncFromEnergyFeed();
    result.success = true;
    result.elapsedMs = Date.now() - startTime;
  } catch (err) {
    result.success = false;
    result.error = err.message;
    result.elapsedMs = Date.now() - startTime;
    result.logs.push({ level: 'error', message: err.message, time: Date.now() - startTime });
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  res.json(result);
}));

/** GET /api/energy-feed/status — current sync cursor date and stats */
router.get('/status', asyncHandler(async (req, res) => {
  const { getSyncStatus } = require('./energyFeed.cron');
  const status = await getSyncStatus();
  res.json(status);
}));

/** GET /api/energy-feed/mapping — read current device→snid mapping */
router.get('/mapping', asyncHandler(async (req, res) => {
  res.json(readMapping());
}));

/** PUT /api/energy-feed/mapping — save device→snid mapping (preserves _buildings) */
router.put('/mapping', asyncHandler(async (req, res) => {
  const mapping = req.body;
  if (!mapping || typeof mapping !== 'object') {
    return res.status(400).json({ error: 'Body must be a JSON object { "deviceId": "snid" }' });
  }
  // Preserve existing _buildings key
  const existing = readMapping();
  const merged = { ...mapping };
  if (existing._buildings) {
    merged._buildings = existing._buildings;
  }
  writeMapping(merged);
  res.json({ success: true, mapping: merged });
}));

/** GET /api/energy-feed/pairing-data — system meters + source meters for pairing UI */
router.get('/pairing-data', asyncHandler(async (req, res) => {
  const { prisma } = require('../../utils/prisma');

  const systemMeters = await prisma.meterInfo.findMany({
    select: { snid: true, type: true, buildingName: true },
    where: { approveStatus: 'approved' },
    orderBy: [{ buildingName: 'asc' }, { type: 'asc' }],
  });

  // System buildings (for building pairing)
  const buildings = await prisma.building.findMany({
    select: { name: true },
    where: {
      OR: [
        { status: null },
        { status: { not: 'INACTIVE' } },
      ],
    },
    orderBy: { name: 'asc' },
  });

  let sourceMeters = [];
  try {
    const FEED_URL = (process.env.ENERGY_FEED_URL || 'http://10.10.161.239:8089').replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${FEED_URL}/vmeter`, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) sourceMeters = await resp.json();
  } catch (e) {
    console.warn('[ENERGY-FEED] Failed to fetch source meters:', e.message);
  }

  const fullMapping = readMapping();

  res.json({
    systemMeters,
    buildings: buildings.map(b => b.name),
    sourceMeters: Array.isArray(sourceMeters) ? sourceMeters : [],
    mapping: (() => { const { _buildings, ...devices } = fullMapping; return devices; })(),
    buildingMap: fullMapping._buildings || {},
    buildingMapEnv: (() => { try { return JSON.parse(process.env.ENERGY_FEED_BUILDING_MAP || '{}'); } catch { return {}; } })(),
  });
}));

/** PUT /api/energy-feed/building-map — save building code→name mapping */
router.put('/building-map', asyncHandler(async (req, res) => {
  const buildingMap = req.body;
  if (!buildingMap || typeof buildingMap !== 'object') {
    return res.status(400).json({ error: 'Body must be a JSON object { "CODE": "building name" }' });
  }
  const full = readMapping();
  full._buildings = buildingMap;
  writeMapping(full);
  res.json({ success: true, buildingMap });
}));

const FEED_URL = (process.env.ENERGY_FEED_URL || 'http://10.10.161.239:8089').replace(/\/+$/, '');

/** GET /api/energy-feed/openapi — returns the OpenAPI spec from power simulator */
router.get('/openapi', asyncHandler(async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${FEED_URL}/openapi.json`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: `Energy feed unreachable: ${e.message}` });
  }
}));

/** ALL /api/energy-feed/proxy — proxy any HTTP method to energy feed API (avoids CORS) */
router.all('/proxy', asyncHandler(async (req, res) => {
  const targetPath = req.query.path || '/';
  const url = `${FEED_URL}${targetPath}`;
  const method = req.method.toUpperCase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const fetchOpts = {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };
    
    // Forward query params from proxy to target (strip 'path' param)
    const targetUrl = new URL(url);
    Object.entries(req.query).forEach(([k, v]) => {
      if (k !== 'path') targetUrl.searchParams.set(k, String(v));
    });

    // Forward request body for methods that have one
    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const resp = await fetch(targetUrl.toString(), fetchOpts);
    clearTimeout(timeout);

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }
    const text = await resp.text();
    res.status(resp.status).type(contentType || 'text/plain').send(text);
  } catch (e) {
    res.status(502).json({ error: `Energy feed unreachable: ${e.message}` });
  }
}));

module.exports = router;
