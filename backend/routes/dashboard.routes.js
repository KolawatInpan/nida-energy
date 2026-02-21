const express = require("express");
const router = express.Router();
const { calculateRateToken, calculateRateEnergy } = require("../utils/rateCalculator");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.get("/rate-token", async (req, res) => {
  const { timeframe } = req.query;
  let where = {};
  const now = new Date();

    if (timeframe === "day") {
      where = { begin: { gte: new Date(now - 24*60*60*1000) } };
    } else if (timeframe === "week") {
      where = { begin: { gte: new Date(now - 7*24*60*60*1000) } };
  }

    const rates = await prisma.rateToken.findMany({
      where,
      orderBy: { begin: "asc" },
  });

  res.json(rates);
});

router.get("/rate-energy", async (req, res) => {
  const { timeframe } = req.query;
  const now = new Date();
  let where = {};

    if (timeframe === "day") {
      where = { begin: { gte: new Date(now - 24*60*60*1000) } };
    } else if (timeframe === "week") {
      where = { begin: { gte: new Date(now - 7*24*60*60*1000) } };
  }

    const rates = await prisma.rateEnergy.findMany({
      where,
      orderBy: { begin: "asc" },
  });

  res.json(rates);
});

router.get("/building-energy", async (req, res) => {
  const { buildingId, timeframe, kind = 'consumed' } = req.query; // kind: consumed|produced|net
  const now = new Date();
  // Prisma schema defines Building.id as String, ensure we pass strings
  const bId = String(buildingId);
  if (!bId) return res.status(400).json({ error: 'buildingId required' });

  // returns array of { label, value }
  const makeZeroArray = (len) => Array.from({ length: len }, () => 0);

  try {
    if (timeframe === 'day') {
  // hourly rows (24 bars) - compact metricType: energy_consume and energy_produce
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const consumedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
  // produced (compact metricType only)
  const producedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
      const byHourC = new Map();
      const byHourP = new Map();
      for (const rr of consumedRows) {
        const d = new Date(rr.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}|${d.getHours()}`;
        byHourC.set(key, (byHourC.get(key) || 0) + Number(rr.value));
      }
      for (const rr of producedRows) {
        const d = new Date(rr.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}|${d.getHours()}`;
        byHourP.set(key, (byHourP.get(key) || 0) + Number(rr.value));
      }
      const labels = [];
      const values = [];
      for (let i = 23; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 60 * 60 * 1000);
        const label = t.getHours() + ':00';
        labels.push(label);
        const key = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}|${t.getHours()}`;
        const c = byHourC.get(key) || 0;
        const p = byHourP.get(key) || 0;
        const v = kind === 'produced' ? p : kind === 'net' ? (p + c) : c;
        values.push(v);
      }
      return res.json(labels.map((l, i) => ({ label: l, value: values[i] })));
    } else if (timeframe === 'week') {
  // 7 daily bars - compact metricType: energy_consume and energy_produce
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const consumedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
  const producedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
      const byDateC = new Map();
      const byDateP = new Map();
      for (const rr of consumedRows) {
        const key = new Date(rr.timestamp).toISOString().slice(0,10);
        byDateC.set(key, (byDateC.get(key) || 0) + Number(rr.value));
      }
      for (const rr of producedRows) {
        const key = new Date(rr.timestamp).toISOString().slice(0,10);
        byDateP.set(key, (byDateP.get(key) || 0) + Number(rr.value));
      }
      const labels = [];
      const values = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = d.toISOString().slice(0,10);
        labels.push(label);
        const c = byDateC.get(label) || 0;
        const p = byDateP.get(label) || 0;
        const v = kind === 'produced' ? p : kind === 'net' ? (p + c) : c;
        values.push(v);
      }
      return res.json(labels.map((l,i) => ({ label: l, value: values[i] })));
    } else if (timeframe === 'month') {
      // 30 daily bars, consume + produced
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const consumedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
  const producedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
      const byDateC = new Map();
      const byDateP = new Map();
      for (const rr of consumedRows) {
        const key = new Date(rr.timestamp).toISOString().slice(0,10);
        byDateC.set(key, (byDateC.get(key) || 0) + Number(rr.value));
      }
      for (const rr of producedRows) {
        const key = new Date(rr.timestamp).toISOString().slice(0,10);
        byDateP.set(key, (byDateP.get(key) || 0) + Number(rr.value));
      }
      const labels = [];
      const values = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = d.toISOString().slice(0,10);
        labels.push(label);
        const c = byDateC.get(label) || 0;
        const p = byDateP.get(label) || 0;
        const v = kind === 'produced' ? p : kind === 'net' ? (p + c) : c;
        values.push(v);
      }
      return res.json(labels.map((l,i) => ({ label: l, value: values[i] })));
    } else if (timeframe === 'year') {
  // 12 monthly bars - compact metricType: energy_consume and energy_produce
      // build last 12 months labels
      // try to read monthly rows
      // monthly bars for consumed and produced
      // try monthly rows first
    let consumedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume' }, orderBy: { timestamp: 'asc' } });
  // produced monthly (compact metricType only)
  const producedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce' }, orderBy: { timestamp: 'asc' } });
      let byMonthC = new Map();
      let byMonthP = new Map();
      if (consumedRows && consumedRows.length) {
        for (const rr of consumedRows) {
          const ps = new Date(rr.timestamp);
          const key = `${ps.getFullYear()}-${String(ps.getMonth()+1).padStart(2,'0')}`;
          byMonthC.set(key, (byMonthC.get(key) || 0) + Number(rr.value));
        }
      } else {
        // fallback: aggregate daily rows into months
        const fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const dailyRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume', timestamp: { gte: fromDate } }, orderBy: { timestamp: 'asc' } });
        for (const rr of dailyRows) {
          const ps = new Date(rr.timestamp);
          const key = `${ps.getFullYear()}-${String(ps.getMonth()+1).padStart(2,'0')}`;
          byMonthC.set(key, (byMonthC.get(key) || 0) + Number(rr.value));
        }
      }
      if (producedRows && producedRows.length) {
        for (const rr of producedRows) {
          const ps = new Date(rr.timestamp);
          const key = `${ps.getFullYear()}-${String(ps.getMonth()+1).padStart(2,'0')}`;
          byMonthP.set(key, (byMonthP.get(key) || 0) + Number(rr.value));
        }
      } else {
        const fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        // produced daily (compact metricType only)
        const dailyRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce', timestamp: { gte: fromDate } }, orderBy: { timestamp: 'asc' } });
        for (const rr of dailyRows) {
          const ps = new Date(rr.timestamp);
          const key = `${ps.getFullYear()}-${String(ps.getMonth()+1).padStart(2,'0')}`;
          byMonthP.set(key, (byMonthP.get(key) || 0) + Number(rr.value));
        }
      }
      const labels = [];
      const values = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        labels.push(label);
        const c = byMonthC.get(label) || 0;
        const p = byMonthP.get(label) || 0;
        const v = kind === 'produced' ? p : kind === 'net' ? (p + c) : c;
        values.push(v);
      }
      return res.json(labels.map((l,i) => ({ label: l, value: values[i] })));
    } else {
      return res.status(400).json({ error: 'invalid timeframe' });
    }
  } catch (err) {
    console.error('building-energy error', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/meter-energy?meterName=&timeframe=&kind=
router.get('/meter-energy', async (req, res) => {
  const { meterName, timeframe, kind = 'consumed' } = req.query;
  if (!meterName) return res.status(400).json({ error: 'meterName required' });
  const now = new Date();
  try {
    if (timeframe === 'day') {
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const consumedRows = await prisma.meterDashboard.findMany({ where: { meterName: meterName, metricType: 'energy_consume', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
  // produced: try compact name first, then fall back to older names
  let producedRows = await prisma.meterDashboard.findMany({ where: { meterName: meterName, metricType: 'energy_produce', timestamp: { gte: from } }, orderBy: { timestamp: 'asc' } });
  // produced hourly: compact metricType only
  // producedRows already assigned above
      const byHourC = new Map();
      const byHourP = new Map();
      for (const rr of consumedRows) {
        const d = new Date(rr.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}|${d.getHours()}`;
        byHourC.set(key, (byHourC.get(key) || 0) + Number(rr.value));
      }
      for (const rr of producedRows) {
        const d = new Date(rr.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}|${d.getHours()}`;
        byHourP.set(key, (byHourP.get(key) || 0) + Number(rr.value));
      }
      const labels = [];
      const values = [];
      for (let i = 23; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 60 * 60 * 1000);
        const label = t.getHours() + ':00';
        labels.push(label);
        const key = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}|${t.getHours()}`;
        const c = byHourC.get(key) || 0;
        const p = byHourP.get(key) || 0;
        const v = kind === 'produced' ? p : kind === 'net' ? (p + c) : c;
        values.push(v);
      }
      return res.json(labels.map((l, i) => ({ label: l, value: values[i] })));
    }
    // For other timeframes, fallback to building-level semantics by finding parent building and delegating
    // Find building for meter
  const meter = await prisma.meter.findUnique({ where: { name: meterName }, include: { building: true } });
    if (!meter) return res.status(404).json({ error: 'meter not found' });
    // delegate to building-energy for week/month/year
    const q = `buildingId=${meter.building.id}&timeframe=${timeframe}&kind=${kind}`;
    const forwardRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/dashboard/building-energy?${q}`);
    const text = await forwardRes.text();
    if (!forwardRes.ok) return res.status(forwardRes.status).send(text);
    return res.send(text);
  } catch (err) {
    console.error('meter-energy error', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/building-energy-compare?buildingId=&years=2024,2025,2026&kind=
router.get('/building-energy-compare', async (req, res) => {
  const { buildingId, years = '', kind = 'consumed' } = req.query;
  // Building.id is a String in Prisma schema; coerce to String
  const bId = String(buildingId);
  if (!bId) return res.status(400).json({ error: 'buildingId required' });
  const yearList = years.split(',').map(y => Number(y)).filter(Boolean);
  if (!yearList.length) return res.status(400).json({ error: 'years required (comma-separated)' });

  try {
    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const datasets = [];

    for (const y of yearList) {
      const start = new Date(Date.UTC(y,0,1,0,0,0));
      const end = new Date(Date.UTC(y+1,0,1,0,0,0));

      // Try monthly pre-aggregates first
  const consumedMonthly = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume', timestamp: { gte: start, lt: end } }, orderBy: { timestamp: 'asc' } });
      // produced monthly try new name then old
  let producedMonthly = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce_monthly', timestamp: { gte: start, lt: end } }, orderBy: { timestamp: 'asc' } });
  if (!producedMonthly || !producedMonthly.length) producedMonthly = [];

      const consumedByMonth = new Map();
      const producedByMonth = new Map();

      if (consumedMonthly && consumedMonthly.length) {
        for (const r of consumedMonthly) {
          const m = new Date(r.periodStart).getMonth();
          consumedByMonth.set(m, (consumedByMonth.get(m) || 0) + Number(r.value));
        }
      } else {
  // aggregate daily (daily aggregates stored under compact type)
  const daily = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_consume', timestamp: { gte: start, lt: end } } });
        for (const r of daily) {
          const m = new Date(r.timestamp).getMonth();
          consumedByMonth.set(m, (consumedByMonth.get(m) || 0) + Number(r.value));
        }
      }

      if (producedMonthly && producedMonthly.length) {
        for (const r of producedMonthly) {
          const m = new Date(r.periodStart).getMonth();
          producedByMonth.set(m, (producedByMonth.get(m) || 0) + Number(r.value));
        }
      } else {
        const dailyP = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: 'energy_produce_daily', timestamp: { gte: start, lt: end } } });
        if (!dailyP || !dailyP.length) {
          // fallback to old name
          // no legacy produced_daily fallback; produced rows are expected under 'energy_produce'
        } else {
          for (const r of dailyP) {
            const m = new Date(r.timestamp).getMonth();
            producedByMonth.set(m, (producedByMonth.get(m) || 0) + Number(r.value));
          }
        }
      }

      const data = [];
      for (let mi = 0; mi < 12; mi++) {
        const c = consumedByMonth.get(mi) || 0;
        const p = producedByMonth.get(mi) || 0;
        const v = kind === 'produced' ? p : kind === 'net' ? (p - c) : c;
        data.push(parseFloat(v.toFixed(6)));
      }

      datasets.push({ label: String(y), data });
    }

    return res.json({ labels: monthLabels, datasets });
  } catch (err) {
    console.error('building-energy-compare error', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/building-energy-month?buildingId=&year=&month=&kind=
router.get('/building-energy-month', async (req, res) => {
  const { buildingId, year, month, kind = 'consumed' } = req.query;
  // Building.id is stored as String in Prisma
  const bId = String(buildingId);
  const y = Number(year);
  const m = Number(month); // 1-12
  if (!bId || !y || !m) return res.status(400).json({ error: 'buildingId, year, month required' });

  try {
    // compute month start and end (UTC)
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

    // metric types
  const consumedType = 'energy_consume';
    const producedTypeNew = 'energy_produce_daily';
  const producedTypeOld = null;

    // sum consumed daily rows in range
  const consumedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: consumedType, timestamp: { gte: start, lt: end } } });
    const consumedSum = consumedRows.reduce((s, r) => s + Number(r.value), 0);

    // try produced new naming first
  let producedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: producedTypeNew, timestamp: { gte: start, lt: end } } });
  if (!producedRows || !producedRows.length) producedRows = await prisma.buildingDashboard.findMany({ where: { buildingId: bId, metricType: producedTypeOld, timestamp: { gte: start, lt: end } } });
    const producedSum = producedRows.reduce((s, r) => s + Number(r.value), 0);

    let value;
    if (kind === 'produced') value = producedSum;
    else if (kind === 'net') value = producedSum - consumedSum;
    else value = consumedSum;

    return res.json({ label: `${y}-${String(m).padStart(2,'0')}`, value });
  } catch (err) {
    console.error('building-energy-month error', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
