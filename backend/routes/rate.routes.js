const express = require('express');
const router = express.Router();
const RateController = require('../controllers/rate.controller');

router.post('/token', RateController.createTokenRate);
router.get('/token', RateController.listTokenRates);
router.post('/energy', RateController.createEnergyRate);
router.get('/energy', RateController.listEnergyRates);

module.exports = router;
