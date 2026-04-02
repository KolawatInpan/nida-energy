const MeterModel = require('./meter.service');
const UserModel = require('../users/user.service');


async function getMeters(req, res) {
  try {
    const meters = await MeterModel.getMeters();
    res.json(meters);
  } catch (err) {
    console.error('getMeters error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getMetersByBuilding(req, res) {
  try {
    const buildingId = req.params.buildingId;
    const meters = await MeterModel.getMetersByBuilding(buildingId);
    res.json(meters);
  } catch (err) {
    console.error('getMetersByBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getMeterBySnid(req, res) {
  try {
    const { snid } = req.params;
    const meter = await MeterModel.getMeterBySnid(snid);
    if (!meter) {
      return res.status(404).json({ error: 'Meter not found' });
    }
    res.json(meter);
  } catch (err) {
    console.error('getMeterBySnid error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getApprovedMeters(req, res) {
  try {
    const meters = await MeterModel.getApprovedMeters();
    res.json(meters);
  } catch (err) {
    console.error('getApprovedMeters error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getApprovedMetersByBuilding(req, res) {
  try {
    const buildingId = req.params.buildingId;
    const meters = await MeterModel.getApprovedMetersByBuilding(buildingId);
    res.json(meters);
  } catch (err) {
    console.error('getApprovedMetersByBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getPendingMeters(req, res) {
  try {
    const meters = await MeterModel.getPendingMeters();
    res.json(meters);
  } catch (err) {
    console.error('getPendingMeters error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getRejectedMeters(req, res) {
  try {
    const meters = await MeterModel.getRejectedMeters();
    res.json(meters);
  } catch (err) {
    console.error('getRejectedMeters error', err);
    res.status(500).json({ error: err.message });
  }
}

async function createMeter(req, res) {
  const { buildingId, meterType, meterNumber, capacity, dateInstalled } = req.body;
  if (!buildingId || !meterType || !meterNumber) {
    return res.status(400).json({ error: 'buildingId, meterType and meterNumber are required' });
  }
  try {
    const newMeter = await MeterModel.createMeter(buildingId, meterType, meterNumber, capacity, dateInstalled);
    res.status(201).json(newMeter);
  } catch (err) {
    console.error('createMeter error', err);
    // Prisma unique constraint or other known errors may include a code
    if (err.message && (err.message.includes('Building not found') || err.message.includes('Missing building identifier'))) {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'P2002') {
      // Unique constraint failed (e.g., snid or meterName already exists)
      return res.status(409).json({ error: 'Unique constraint failed', detail: err.meta || err.message });
    }
    // Fallback: include code/message for easier debugging
    return res.status(500).json({ error: err.message || 'createMeter failed', code: err.code || null });
  }
}

async function updateMeter(req, res) {
  try {
    const payload = {
      buildingName: req.body?.buildingName,
      type: req.body?.type,
      capacity: req.body?.capacity,
      status: req.body?.status,
    };
    const updated = await MeterModel.updateMeter(req.params.snid, payload);
    res.json(updated);
  } catch (err) {
    console.error('updateMeter error', err);
    if (err.message === 'Invalid meter id') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Meter not found' || err.message === 'Building not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteMeter(req, res) {
  try {
    await MeterModel.deleteMeter(req.params.snid);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteMeter error', err);
    if (err.message === 'Invalid meter id') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Meter not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete meter with related records' });
    }
    res.status(500).json({ error: err.message });
  }
}

module.exports = { 
  getMeters,
  getMetersByBuilding,
  getMeterBySnid,
  getApprovedMeters,
  getApprovedMetersByBuilding,
  getPendingMeters,
  getRejectedMeters,
  createMeter,
  updateMeter,
  deleteMeter
 };


