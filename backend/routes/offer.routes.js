const express = require('express');
const router = express.Router();
const OfferController = require('../controllers/offer.controller');

router.get('/', OfferController.getOffers);
router.get('/:id', OfferController.getOfferById);
router.get('/building/:walletId', OfferController.getBuildingByWalletId);

module.exports = router;