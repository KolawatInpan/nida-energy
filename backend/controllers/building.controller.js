const BuildingModel = require('../models/building.model');

async function getBuildings(req, res) {
  try {
    const list = await BuildingModel.getBuildings();
    res.json(list);
  } catch (err) {
    console.error('getBuildings error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getBuilding(req, res) {
  const { id } = req.params;
  try {
    const building = await BuildingModel.getBuilding(id);
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }
    res.json(building);
  } catch (err) {
    console.error('getBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getTotalMeters(req, res) {
  const { buildingId } = req.params;
  try {
    const count = await BuildingModel.getTotalMeters(buildingId);
    res.json({ totalMeters: count });
  } catch (err) {
    console.error('getTotalMeters error', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getBuildings,
  getBuilding,
  getTotalMeters
};
