const express = require('express');
const router = express.Router();
const { handleCreateBattery, handleGetBattery, handleListBatteries, handleProduceBattery } = require('../controllers/battery.controller');

router.post('/', handleCreateBattery);
router.get('/', handleListBatteries);
router.get('/:id', handleGetBattery);
router.post('/:id/produce', handleProduceBattery);

module.exports = router;