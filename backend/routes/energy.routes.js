const express = require('express');
const router = express.Router();
const EnergyController = require('../controllers/energy.controller');

router.get('/', EnergyController.listMeters);
router.get('/:meterName', EnergyController.getMeter);
router.post('/', EnergyController.createMeter);
router.put('/:meterName', EnergyController.updateMeter);
router.delete('/:meterName', EnergyController.deleteMeter);

router.post('/dashboards', EnergyController.addMeterDashboard);
router.get('/dashboards/list', EnergyController.listMeterDashboards);
// hourly/daily energy endpoints
router.post('/hourly', EnergyController.createHourlyEnergy);
router.post('/daily', EnergyController.createDailyEnergy);

module.exports = router;
