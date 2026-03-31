const express = require('express');
const router = express.Router();
const EnergyController = require('./energy.controller');

router.get('/buildings', EnergyController.getBuildingEnergy);

module.exports = router;



