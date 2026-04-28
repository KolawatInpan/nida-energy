const express = require('express');
const router = express.Router();
const OfferController = require('./offer.controller');

/**
 * @openapi
 * /api/offers:
 *   get:
 *     summary: Get list of energy offers
 *     tags:
 *       - Offer
 *     responses:
 *       '200':
 *         description: Array of offers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 offers:
 *                   type: array
 *             example:
 *               offers: [{ "id":1, "sellerWalletId":"w_123", "kwh":10 }]
 */
router.get('/', OfferController.getOffers);

/**
 * @openapi
 * /api/offers:
 *   post:
 *     summary: Create a new energy offer (sell energy)
 *     tags:
 *       - Offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OfferCreate'
 *     responses:
 *       '201':
 *         description: Offer created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OfferResponse'
 *             examples:
 *               created:
 *                 value:
 *                   id: 1
 *                   sellerWalletId: w_123
 *                   kwh: 10
 */
router.post('/', OfferController.createOffer);

/**
 * @openapi
 * /api/offers/{id}:
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OfferResponse'
 *       '404':
 *         description: Offer not found
 */
router.get('/:id', OfferController.getOfferById);

/**
 * @openapi
 * /api/offers/building/{walletId}:
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


