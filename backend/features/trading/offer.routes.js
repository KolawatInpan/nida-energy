const express = require('express');
const router = express.Router();
const OfferController = require('./offer.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

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
 * /api/offers/bids:
 *   get:
 *     summary: Get list of energy bids
 *     tags:
 *       - Offer
 *     responses:
 *       '200':
 *         description: Array of bids
 */
router.get('/bids', OfferController.getBids);

/**
 * @openapi
 * /api/offers/bids:
 *   post:
 *     summary: Create a new energy bid (buy energy / auto-buy)
 *     tags:
 *       - Offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               buyerWalletId:
 *                 type: string
 *               kwh:
 *                 type: number
 *     responses:
 *       '201':
 *         description: Bid created
 */
router.post('/bids', OfferController.createBid);

/**
 * @openapi
 * /api/offers/trigger-clearing:
 *   post:
 *     summary: Manually trigger Day-Ahead market clearing (For Testing/Demo)
 *     tags:
 *       - Offer
 */
router.post('/trigger-clearing', OfferController.triggerClearing);

/**
 * Admin: manually run auto-trading for a building (for testing)
 * POST /api/offers/run-auto
 * body: { buildingName: 'Building Name' }
 */
router.post('/run-auto', auth, requireRole('ADMIN'), OfferController.runAutoForBuilding);

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
 */
router.get('/building/:walletId', OfferController.getBuildingByWalletId);

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
 * /api/offers/{id}/cancel:
 *   put:
 *     summary: Cancel an offer
 *     tags:
 *       - Offer
 */
router.put('/:id/cancel', OfferController.cancelOffer);

/**
 * @openapi
 * /api/offers/bids/{id}/cancel:
 *   put:
 *     summary: Cancel a bid
 *     tags:
 *       - Offer
 */
router.put('/bids/:id/cancel', OfferController.cancelBid);

module.exports = router;
