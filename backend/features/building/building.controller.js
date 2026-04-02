const BuildingModel = require('./building.service');

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

async function getBuildingByEmail(req, res) {
  const { email } = req.params;
  try {
    const building = await BuildingModel.getBuildingByEmail(email);
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }
    res.json(building);
  } catch (err) {
    console.error('getBuildingByEmail error', err);
    res.status(500).json({ error: err.message });
  }
}

async function createBuilding(req, res) {
  const { name, url, mapURL, googleMapsUrl, address, province, postalCode, email } = req.body;
  // accept multiple possible keys for the maps URL coming from different clients
  const finalMapURL = url || mapURL || googleMapsUrl || null;
  console.debug('createBuilding payload:', { name, mapURL: finalMapURL, address, province, postalCode, email });
  try {
    const newBuilding = await BuildingModel.createBuilding(name, finalMapURL, address, province, postalCode, email);
    res.status(201).json(newBuilding);
  } catch (err) {
    console.error('createBuilding error', err);
    if (err && err.message === 'All fields are required') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateBuilding(req, res) {
  try {
    const updated = await BuildingModel.updateBuilding(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error('updateBuilding error', err);
    if (err.message === 'Building not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Invalid building id') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteBuilding(req, res) {
  try {
    await BuildingModel.deleteBuilding(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteBuilding error', err);
    if (err.message === 'Invalid building id') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete building with related records' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Building not found' });
    }
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getBuildings,
  getBuilding,
  getTotalMeters,
  getBuildingByEmail,
  createBuilding,
  updateBuilding,
  deleteBuilding,
};


