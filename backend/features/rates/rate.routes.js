const express = require('express');
const router = express.Router();
const RateController = require('./rate.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

router.post('/token', auth, requireRole('ADMIN'), RateController.createTokenRate);
router.get('/token', RateController.listTokenRates);
router.post('/energy', auth, requireRole('ADMIN'), RateController.createEnergyRate);
router.get('/energy', RateController.listEnergyRates);

module.exports = router;



