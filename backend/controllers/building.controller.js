const BuildingModel = require('../models/building.model');
const UserModel = require('../models/user.model');
const energyModel = require('../models/meter.model');

async function getBuildings(req, res) {
  try {
    const list = await BuildingModel.getAllBuildings();
    res.json(list);
  } catch (err) {
    console.error('getBuildings error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getBuilding(req, res) {
  try {
    const id = req.params.id;
    const b = await BuildingModel.getBuildingById(id);
    if (!b) return res.status(404).json({ error: 'building not found' });
    res.json(b);
  } catch (err) {
    console.error('getBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

async function createBuilding(req, res) {
  try {
    const { name, mapURL, address, province, postal, email, ownerId, meters } = req.body || {};
    // resolve owner email: prefer authenticated user email, then explicit email, then ownerId lookup
    let ownerEmail = null;
    if (req.user && req.user.email) ownerEmail = req.user.email;
    else if (email) ownerEmail = email;
    else if (ownerId) {
      const u = await UserModel.getUserById(ownerId) || await UserModel.getUserByEmail(ownerId);
      if (u && u.email) ownerEmail = u.email;
    }

    let createdUser = null;
    let token = null;
    const jwt = require('jsonwebtoken');
    function signToken(payload) {
      const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret';
      return jwt.sign(payload, secret, { expiresIn: '30d' });
    }

    // If owner email not resolved, attempt to create user from payload (support registration flow)
    if (!ownerEmail) {
      // Accept user info in `user` object or common contact fields (contactName/contactEmail/contactPassword)
      const userPayload = req.body.user || {
        name: req.body.ownerName || req.body.ownerFullName || req.body.contactName || null,
        email: req.body.ownerEmail || req.body.email || req.body.contactEmail || null,
        password: req.body.ownerPassword || req.body.password || req.body.contactPassword || null,
        telNum: req.body.ownerPhone || req.body.contactPhone || req.body.telNum || null
      };
      if (userPayload && userPayload.email && userPayload.password && userPayload.name) {
        try {
          createdUser = await UserModel.createUser(userPayload.name, userPayload.email, userPayload.password, undefined, userPayload.telNum);
          ownerEmail = createdUser.email;
          token = signToken({ user: createdUser });
        } catch (e) {
          // if user already exists, resolve to existing user
          if (e && e.status === 409) {
            const existing = await UserModel.getUserByEmail(userPayload.email);
            if (existing) ownerEmail = existing.email;
            else throw e;
          } else {
            throw e;
          }
        }
      } else {
        const e = new Error('owner email not provided or resolvable and insufficient user payload to create one');
        e.status = 400;
        throw e;
      }
    }
    // If ownerEmail provided but user doesn't exist, create the user from payload or generate credentials
    if (ownerEmail) {
      const existingOwner = await UserModel.getUserByEmail(ownerEmail);
      if (!existingOwner) {
        // Try to build user payload from request
        const up = req.body.user || {
          name: req.body.ownerName || req.body.ownerFullName || req.body.contactName || ownerEmail.split('@')[0],
          email: ownerEmail,
          password: req.body.ownerPassword || req.body.password || req.body.contactPassword,
          telNum: req.body.ownerPhone || req.body.contactPhone || req.body.telNum || null
        };
        // generate a password if none provided
        if (!up.password) {
          const crypto = require('crypto');
          up.password = crypto.randomBytes(8).toString('hex');
        }
        try {
          createdUser = await UserModel.createUser(up.name, up.email, up.password, undefined, up.telNum);
          token = signToken({ user: createdUser });
        } catch (e) {
          // if creation failed due to race, fetch existing user
          if (e && e.status === 409) {
            const existing = await UserModel.getUserByEmail(ownerEmail);
            if (existing) createdUser = existing;
            else throw e;
          } else {
            throw e;
          }
        }
      } else {
        // owner already exists
        createdUser = existingOwner;
      }
    }

    const created = await BuildingModel.createBuilding({ name, mapURL, address, province, postal, ownerEmail });
    console.log('createBuilding: created ->', created);

    // create meters if provided
    let createdMeters = [];
    if (Array.isArray(meters) && meters.length) {
      for (const m of meters) {
        try {
          const meter = await energyModel.createMeterWithSeed({
            meterName: m.name || m.meterName,
            buildingId: created.id,
            SN: m.SN || m.SN,
            produceMeter: !!m.produceMeter,
            consumeMeter: !!m.consumeMeter,
            batMeter: !!m.batMeter,
            capacity: m.capacity || null,
            dateInstalled: m.dateInstalled || m.installationDate || null,
          });
          createdMeters.push(meter);
        } catch (e) {
          // skip duplicates
          if (e && e.code === 'EEXIST') continue;
          else throw e;
        }
      }
    }

    const resp = { building: created, meters: createdMeters };
    if (createdUser) resp.user = createdUser;
    if (token) resp.token = token;
    res.status(201).json(resp);
  } catch (err) {
    console.error('createBuilding error', err);
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function updateBuilding(req, res) {
  try {
    const id = req.params.id;
    const data = req.body || {};
    const updated = await BuildingModel.updateBuilding(id, data);
    res.json(updated);
  } catch (err) {
    console.error('updateBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteBuilding(req, res) {
  try {
    const id = req.params.id;
    await BuildingModel.deleteBuilding(id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /:id/meters -> create meter under building
async function createMeterForBuilding(req, res) {
  try {
    const buildingId = req.params.id;
    const { name, SN } = req.body || {};
    if (!name) return res.status(400).json({ error: 'meter name required' });
    // find building
    const b = await BuildingModel.getBuildingById(buildingId);
    if (!b) return res.status(404).json({ error: 'building not found' });
    try {
      const meter = await energyModel.createMeterWithSeed({ meterName: name, buildingId: b.id, SN, capacity: req.body.capacity || null, dateInstalled: req.body.dateInstalled || req.body.installationDate || null });
      return res.status(201).json(meter);
    } catch (e) {
      if (e && e.code === 'EEXIST') return res.status(409).json({ error: 'meter already exists' });
      throw e;
    }
  } catch (err) {
    console.error('createMeterForBuilding error', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  createMeterForBuilding,
};
