const MeterModel = require('../models/meter.model');
const UserModel = require('../models/user.model');


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

module.exports = { 
  getMeters,
  getMetersByBuilding,
  getApprovedMeters,
  getApprovedMetersByBuilding,
  getPendingMeters,
  getRejectedMeters
 };