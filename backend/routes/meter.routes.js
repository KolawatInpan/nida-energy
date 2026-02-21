const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MeterModel = require('../models/meter.model');
const MeterController = require('../controllers/meter.controller');

// GET /api/meters?buildingId=
router.get('/', MeterController.listPendingMeters);
router.get('/:snid', MeterController.getMeterBySNID);
// note: MeterController.listPendingMeters handles pending listing. To support buildingId or other query params,
// we can extend MeterController or add separate routes.

// POST /api/meters -> { name, buildingId, SN? }
router.post('/', async (req, res) => {
  const { name, buildingId, SN } = req.body;
  if (!name) return res.status(400).json({ error: 'meter name required' });
  if (!buildingId) return res.status(400).json({ error: 'buildingId required' });
  try {
    // find building by id or name
    const bid = String(buildingId);
    let b = await prisma.building.findUnique({ where: { id: bid } });
    if (!b) b = await prisma.building.findUnique({ where: { name: bid } });
    if (!b) return res.status(404).json({ error: 'building not found' });

    // delegate to meter model helper which creates and seeds
    try {
      // forward optional SN to allow manual serial numbers
      const meter = await MeterModel.createMeterWithSeed({ meterName: name, buildingId: b.id, SN, capacity: req.body.capacity || null, dateInstalled: req.body.dateInstalled || req.body.installationDate || null });
      return res.status(201).json(meter);
    } catch (e) {
      if (e && e.code === 'EEXIST') return res.status(409).json({ error: 'meter already exists' });
      throw e;
    }
  } catch (err) {
    console.error('create meter error', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/meters/:snid/approve -> { approve: true }
router.put('/:snid/approve', async (req, res) => {
  try {
    const snid = req.params.snid;
    const approve = req.body && typeof req.body.approve !== 'undefined' ? !!req.body.approve : true;
    const updated = await MeterModel.approveMeter(snid, approve);
    res.json(updated);
  } catch (err) {
    console.error('approve meter error', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
