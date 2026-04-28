const express = require('express');
const router = express.Router();
const RateController = require('./rate.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

/**
 * @openapi
 * /rates/token:
 *   post:
 *     summary: Create token rate (admin)
 *     tags:
 *       - Rates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Token rate created
 */
router.post('/token', auth, requireRole('ADMIN'), RateController.createTokenRate);

/**
 * @openapi
 * /rates/token:
 *   get:
 *     summary: List token rates
 *     tags:
 *       - Rates
 *     responses:
 *       '200':
 *         description: Array of token rates
 */
router.get('/token', RateController.listTokenRates);

/**
 * @openapi
 * /rates/energy:
 *   post:
 *     summary: Create energy rate (admin)
 *     tags:
 *       - Rates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Energy rate created
 */
router.post('/energy', auth, requireRole('ADMIN'), RateController.createEnergyRate);

/**
 * @openapi
 * /rates/energy:
 *   get:
 *     summary: List energy rates
 *     tags:
 *       - Rates
 *     responses:
 *       '200':
 *         description: Array of energy rates
 */
router.get('/energy', RateController.listEnergyRates);

/**
 * Examples:
 * POST /api/rates/token request:
 *   { "symbol": "NIDA", "rate": 1.23 }
 * POST /api/rates/token response:
 *   { "id": 1, "symbol": "NIDA", "rate": 1.23 }
 */

module.exports = router;



