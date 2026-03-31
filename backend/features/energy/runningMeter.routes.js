const express = require('express');
const router = express.Router();
const RunningMeterController = require('./runningMeter.controller');

router.post('/create', RunningMeterController.createRunningEntry);
router.post('/generate-hourly', RunningMeterController.generateHourlyEntries);
router.post('/insert-log', RunningMeterController.insertRunningLog);
router.post('/insert-logs-bulk', RunningMeterController.insertRunningLogsBulk);
router.post('/reset-energy-logs', RunningMeterController.resetEnergyLogs);

module.exports = router;



