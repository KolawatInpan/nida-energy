const express = require('express');
const router = express.Router();
const OfferController = require('./offer.controller');

/**
 * @openapi
 * /offers:
 *   get:
 *     summary: Get list of energy offers
 *     tags:
 *       - Offer
 *     responses:
 *       '200':
 *         description: Array of offers
 */
router.get('/', OfferController.getOffers);

/**
 * @openapi
 * /offers:
 *   post:
 *     summary: Create a new energy offer (sell energy)
 *     tags:
 *       - Offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sellerWalletId, kwh, ratePerKwh]
 *             properties:
 *               sellerWalletId:
 *                 type: string
 *               kwh:
 *                 type: number
 *               ratePerKwh:
 *                 type: number
 *     responses:
 *       '201':
 *         description: Offer created
 */
router.post('/', OfferController.createOffer);

/**
 * @openapi
 * /offers/{id}:
 *   get:
 *     summary: Get offer by id
 *     tags:
 *       - Offer
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Offer object
 *       '404':
 *         description: Offer not found
 */
router.get('/:id', OfferController.getOfferById);

/**
 * @openapi
 * /offers/building/{walletId}:
 *   get:
 *     summary: Get building by walletId (used in market mapping)
 *     tags:
 *       - Offer
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Building object
 *       '404':
 *         description: Building not found for wallet
 */
router.get('/building/:walletId', OfferController.getBuildingByWalletId);

module.exports = router;


