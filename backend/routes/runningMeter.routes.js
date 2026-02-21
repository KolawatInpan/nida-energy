const express = require('express');
const router = express.Router();
const RunningController = require('../controllers/runningMeter.controller');

// POST /api/energy/running -> ingest a running meter datapoint
router.post('/', RunningController.ingestRunning);

module.exports = router;
