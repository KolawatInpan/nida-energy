const express = require('express');
const router = express.Router();
const MeterController = require('../controllers/meter.controller');

router.get('/', MeterController.getMeters);
router.get('/building/:buildingId', MeterController.getMetersByBuilding);
router.get('/approved', MeterController.getApprovedMeters);
router.get('/approved/building/:buildingId', MeterController.getApprovedMetersByBuilding);
router.get('/pending', MeterController.getPendingMeters);
router.get('/rejected', MeterController.getRejectedMeters);
module.exports = router;
