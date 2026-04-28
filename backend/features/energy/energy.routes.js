const express = require('express');
const router = express.Router();
const EnergyController = require('./energy.controller');

/**
 * @openapi
 * /api/energy/buildings:
 *   get:
 *     summary: Get aggregated building energy
 *     tags:
 *       - Energy
 *     responses:
 *       '200':
 *         description: Aggregated energy data
 *         content:
 *           application/json:
 *             example:
 *               [{ "buildingId":1, "kwh":123.4 }]
 */
router.get('/buildings', EnergyController.getBuildingEnergy);

module.exports = router;



