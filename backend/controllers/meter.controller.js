const MeterModel = require('../models/meter.model');

async function listPendingMeters(req, res) {
  try {
    // support query param ?pending=true (default) or ?approved=true
    const q = req.query || {};
    let list = [];
    if (q.approved === 'true' || q.approved === true) {
      list = await MeterModel.getApprovedMeters();
    } else if (q.pending === 'false' || q.pending === false || q.approved === 'false') {
      list = await MeterModel.getApprovedMeters();
    } else {
      list = await MeterModel.getPendingMeters();
    }
    res.json(list);
  } catch (err) {
    console.error('listPendingMeters error', err);
    res.status(500).json({ error: err.message });
  }
}

async function createMeter(req, res) {
  try {
    const { name, buildingId, SN, capacity, dateInstalled } = req.body || {};
    if (!name || !buildingId) return res.status(400).json({ error: 'name and buildingId required' });
    const m = await MeterModel.createMeterWithSeed({ meterName: name, buildingId, SN, capacity, dateInstalled });
    res.status(201).json(m);
  } catch (err) {
    console.error('createMeter error', err);
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function approveMeter(req, res) {
  try {
    const snid = req.params.snid;
    const approve = req.body && typeof req.body.approve !== 'undefined' ? !!req.body.approve : true;
    const updated = await MeterModel.approveMeter(snid, approve);
    res.json(updated);
  } catch (err) {
    console.error('approveMeter error', err);
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getMeterBySNID(req, res) {
    try {
        const snid = req.params.snid;
        const meter = await MeterModel.getMeterBySNID(snid);
        if (!meter) return res.status(404).json({ error: 'meter not found' });
        res.json(meter);
    } catch (err) {
        console.error('getMeterBySNID error', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { listPendingMeters, createMeter, approveMeter, getMeterBySNID };