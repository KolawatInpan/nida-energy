/**
 * Mock Power Simulator Server
 * 
 * Mimics the production ws-power-simulator API (10.10.161.239:8089)
 * for local development. Run standalone or via docker-compose.dev.yml.
 *
 * Endpoints:
 *   GET  /info              — health check + metadata
 *   GET  /vmeter            — list virtual meters
 *   GET  /vmeter/:id        — get single meter
 *   POST /vmeter            — create meter
 *   PUT  /vmeter/:id/kwh    — update meter kWh
 *   DELETE /vmeter/:id      — delete meter
 *   GET  /meterlog          — query meter logs (with device, limit, time_from, time_to)
 *   POST /meterlog          — create meter log
 *   GET  /simulation/power  — simulated power value
 *   GET  /openapi.json      — OpenAPI spec
 *   POST /import            — import real data from production
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8089;

app.use(cors());
app.use(express.json({ limit: '200mb' }));

// ─── Sample Data ────────────────────────────────────────────────

const BUILDINGS = [
  { code: 'NSP', name: 'นิด้า สรรพคุณ' },
  { code: 'NRT', name: 'นรา ทิพย์' },
  { code: 'NBS', name: 'นิด้า บางซื่อ' },
  { code: 'SP2', name: 'สรรพคุณ 2' },
  { code: 'SFA', name: 'ทราย ฟ้า' },
];

const METER_TYPES = ['PRD', 'CON', 'BAT'];

// Generate meters for each building
function generateMeters() {
  const meters = [];
  for (const bld of BUILDINGS) {
    for (const type of METER_TYPES) {
      const num = 1000 + Math.floor(Math.random() * 9000);
      const meterId = `S-${bld.code}-${type}-${num}`;
      let initKwh;
      if (type === 'PRD') initKwh = 500 + Math.random() * 3000;
      else if (type === 'CON') initKwh = 300 + Math.random() * 2000;
      else initKwh = 5 + Math.random() * 15; // battery 5-20 kWh

      meters.push({
        meter_id: meterId,
        name: `${bld.name} ${type === 'PRD' ? 'Solar' : type === 'CON' ? 'Building' : 'Battery'}`,
        kwh: Math.round(initKwh * 100) / 100,
        type,
        building_code: bld.code,
      });
    }
  }
  return meters;
}

// ─── Data Loading: prefer imported production data from JSON files ───
const fs = require('fs');
const path = require('path');

function loadJsonFile(fileName) {
  try {
    const filePath = path.join(__dirname, fileName);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`📂 Loaded ${fileName} (${Array.isArray(data) ? data.length : 'object'})`);
      return data;
    }
  } catch (err) {
    console.warn(`⚠️  Failed to load ${fileName}: ${err.message}`);
  }
  return null;
}

const importedMeters = loadJsonFile('vmeter.json');
let meters = Array.isArray(importedMeters) && importedMeters.length > 0 ? importedMeters : generateMeters();

const importedLogs = loadJsonFile('meterlog_all.json');
let cachedLogs = Array.isArray(importedLogs) && importedLogs.length > 0 ? importedLogs : generateLogs(100);


// Generate logs for the last N entries
function generateLogs(count = 50) {
  const logs = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const meter = meters[Math.floor(Math.random() * meters.length)];
    let kW, kWh;

    if (meter.type === 'PRD') {
      // Solar: 0-5 kW production
      const hour = new Date(now - i * 60000).getHours();
      const solarFactor = hour >= 6 && hour <= 18
        ? Math.sin((hour - 6) / 12 * Math.PI)
        : 0;
      kW = Math.round(solarFactor * 3.5 * 100) / 100;
      kWh = Math.round(kW * (1 / 60) * 100) / 100; // kWh for 1 minute
    } else if (meter.type === 'CON') {
      // Consumer: 0.5-4 kW consumption
      kW = Math.round((0.5 + Math.random() * 3.5) * 100) / 100;
      kWh = Math.round(kW * (1 / 60) * 100) / 100;
    } else {
      // Battery: charge/discharge 0-2 kW
      kW = Math.round((Math.random() * 2 - 1) * 100) / 100; // negative = discharging
      kWh = Math.round(Math.abs(kW) * (1 / 60) * 100) / 100;
    }

    logs.push({
      _id: `log_${Date.now()}_${i}`,
      Device: meter.meter_id,
      DataDateTime: new Date(now - i * 60000).toISOString(),
      kW,
      kWh,
      createAt: Math.floor((now - i * 60000) / 1000),
    });
  }
  return logs;
}

// ─── Routes ─────────────────────────────────────────────────────

// GET /info — health check
app.get('/info', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Mock Power Simulator',
    version: '1.0.0-dev',
    meters_count: meters.length,
    uptime: process.uptime(),
    message: 'Local dev mock — not connected to real IoT devices',
  });
});

// GET /vmeter — list all meters
app.get('/vmeter', (req, res) => {
  res.json(meters);
});

// GET /vmeter/:id — get single meter
app.get('/vmeter/:id', (req, res) => {
  const meter = meters.find(m => m.meter_id === req.params.id);
  if (!meter) return res.status(404).json({ error: 'Meter not found' });
  res.json(meter);
});

// POST /vmeter — create meter
app.post('/vmeter', (req, res) => {
  const { meter_id, name, init_kwh = 0 } = req.body;
  if (!meter_id) return res.status(400).json({ error: 'meter_id required' });
  if (meters.find(m => m.meter_id === meter_id)) {
    return res.status(409).json({ error: 'Meter already exists' });
  }
  const parts = meter_id.split('-');
  const buildingCode = parts[0] === 'S' ? parts[1] : parts[0];
  const typeCode = parts[0] === 'S' ? parts[2] : parts[1];
  const newMeter = {
    meter_id,
    name: name || meter_id,
    kwh: init_kwh,
    type: typeCode || 'UNK',
    building_code: buildingCode || 'UNK',
  };
  meters.push(newMeter);
  res.status(201).json(newMeter);
});

// PUT /vmeter/:id/kwh — update kWh
app.put('/vmeter/:id/kwh', (req, res) => {
  const meter = meters.find(m => m.meter_id === req.params.id);
  if (!meter) return res.status(404).json({ error: 'Meter not found' });
  meter.kwh = Number(req.body.kwh) || 0;
  res.json(meter);
});

// DELETE /vmeter/:id
app.delete('/vmeter/:id', (req, res) => {
  const idx = meters.findIndex(m => m.meter_id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Meter not found' });
  meters.splice(idx, 1);
  res.json({ success: true });
});

// GET /meterlog — query logs
app.get('/meterlog', (req, res) => {
  let logs = [...cachedLogs];

  // Filter by device
  if (req.query.device) {
    logs = logs.filter(l => l.Device === req.query.device);
  }

  // Filter by time range
  const hasTimeFrom = !!req.query.time_from;
  if (req.query.time_from) {
    const from = new Date(req.query.time_from).getTime();
    logs = logs.filter(l => new Date(l.DataDateTime).getTime() >= from);
  }
  if (req.query.time_to) {
    const to = new Date(req.query.time_to).getTime();
    logs = logs.filter(l => new Date(l.DataDateTime).getTime() <= to);
  }

  // Limit
  const limit = Math.min(Number(req.query.limit) || 100, 1000);

  // No time_from → return the NEWEST logs first (mimics production API default)
  // With time_from → keep ascending order (for cursor pagination in the cron)
  if (!hasTimeFrom) {
    logs = logs
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.DataDateTime).getTime();
        const tb = new Date(b.DataDateTime).getTime();
        return tb - ta;
      });
  }
  logs = logs.slice(0, limit);

  res.json(logs);
});

// POST /meterlog — create log entry
app.post('/meterlog', (req, res) => {
  const { Device, kW, kWh } = req.body;
  if (!Device) return res.status(400).json({ error: 'Device required' });

  const log = {
    _id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    Device,
    DataDateTime: new Date().toISOString(),
    kW: Number(kW) || 0,
    kWh: Number(kWh) || 0,
    createAt: Math.floor(Date.now() / 1000),
  };
  cachedLogs.unshift(log);
  if (cachedLogs.length > 1000) cachedLogs = cachedLogs.slice(0, 1000);

  // Update meter kWh
  const meter = meters.find(m => m.meter_id === Device);
  if (meter) meter.kwh = (meter.kwh || 0) + (Number(kWh) || 0);

  res.status(201).json(log);
});

// GET /simulation/power — simulated power value
app.get('/simulation/power', (req, res) => {
  const type = req.query.type || 'producer';
  const peak = Number(req.query.peak) || 5;
  const capacity = Number(req.query.capacity) || 16;

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  let power;
  if (type === 'producer') {
    // Solar curve: peak at noon
    const solarFactor = hour >= 6 && hour <= 18
      ? Math.sin((hour - 6) / 12 * Math.PI)
      : 0;
    power = solarFactor * peak;
  } else if (type === 'consumer') {
    // Random consumption 20-80% of peak
    power = peak * (0.2 + Math.random() * 0.6);
  } else {
    // Battery: random charge/discharge
    power = (Math.random() - 0.3) * peak * 0.5;
  }

  res.json({
    type,
    peak_kw: peak,
    current_kw: Math.round(power * 100) / 100,
    timestamp: now.toISOString(),
    battery_capacity_kwh: type === 'battery' ? capacity : undefined,
  });
});

// POST /import — import real data from production
app.post('/import', (req, res) => {
  const { meters: m, logs: l, info: i } = req.body;
  if (Array.isArray(m) && m.length > 0) {
    meters = m;
    console.log(`Imported ${m.length} meters`);
  }
  if (Array.isArray(l) && l.length > 0) {
    cachedLogs = l;
    console.log(`Imported ${l.length} logs`);
  }
  res.json({ success: true, meters: meters.length, logs: cachedLogs.length });
});

// GET /openapi.json — basic OpenAPI spec
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Mock Power Simulator API',
      version: '1.0.0-dev',
      description: 'Local mock for development — mimics ws-power-simulator',
    },
    paths: {
      '/info': { get: { summary: 'Health check' } },
      '/vmeter': {
        get: { summary: 'List virtual meters' },
        post: { summary: 'Create virtual meter' },
      },
      '/vmeter/{id}': {
        get: { summary: 'Get single meter' },
        delete: { summary: 'Delete meter' },
      },
      '/vmeter/{id}/kwh': { put: { summary: 'Update meter kWh' } },
      '/meterlog': {
        get: { summary: 'Query meter logs' },
        post: { summary: 'Create meter log' },
      },
      '/simulation/power': { get: { summary: 'Simulated power value' } },
    },
  });
});

// ─── Start ──────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔌 Mock Power Simulator running on http://localhost:${PORT}`);
  console.log(`   Meters: ${meters.length} | Logs: ${cachedLogs.length}`);
  console.log(`   Endpoints: /info, /vmeter, /meterlog, /simulation/power, /openapi.json`);
});