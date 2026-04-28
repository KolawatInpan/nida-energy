const express = require('express');
const router = express.Router();
const MeterController = require('./meter.controller');

/**
 * @openapi
 * /api/meters:
 *   get:
 *     summary: Get list of meters
 *     tags:
 *       - Meter
 *     responses:
 *       '200':
 *         description: Array of meters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       snid:
 *                         type: string
 *             example:
 *               meters: [{ "id": 1, "snid": "SN123" }]
 */
router.get('/', MeterController.getMeters);

/**
 * @openapi
 * /meters/building/{buildingId}:
 *   get:
 *     summary: Get meters by building id
 *     tags:
 *       - Meter
 *     parameters:
 *       - name: buildingId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Array of meters for the building
 */
router.get('/building/:buildingId', MeterController.getMetersByBuilding);

/**
 * @openapi
 * /meters/snid/{snid}:
 *   get:
 *     summary: Get meter by SNID
 *     tags:
 *       - Meter
 *     parameters:
 *       - name: snid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Meter object
 *       '404':
 *         description: Meter not found
 */
router.get('/snid/:snid', MeterController.getMeterBySnid);

/**
 * @openapi
 * /meters/approved:
 *   get:
 *     summary: Get approved meters
 *     tags:
 *       - Meter
 *     responses:
 *       '200':
 *         description: Array of approved meters
 */
router.get('/approved', MeterController.getApprovedMeters);

/**
 * @openapi
 * /meters/approved/building/{buildingId}:
 *   get:
 *     summary: Get approved meters by building id
 *     tags:
 *       - Meter
 *     parameters:
 *       - name: buildingId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Array of approved meters for building
 */
router.get('/approved/building/:buildingId', MeterController.getApprovedMetersByBuilding);

/**
 * @openapi
 * /meters/pending:
 *   get:
 *     summary: Get pending meters
 *     tags:
 *       - Meter
 *     responses:
 *       '200':
 *         description: Array of pending meters
 */
router.get('/pending', MeterController.getPendingMeters);

/**
 * @openapi
 * /meters/rejected:
 *   get:
 *     summary: Get rejected meters
 *     tags:
 *       - Meter
 *     responses:
 *       '200':
 *         description: Array of rejected meters
 */
router.get('/rejected', MeterController.getRejectedMeters);

/**
 * @openapi
 * /api/meters/register:
 *   post:
 *     summary: Register a new meter (request)
 *     tags:
 *       - Meter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MeterRegister'
 *     responses:
 *       '201':
 *         description: Meter created (pending approval)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *             example:
 *               id: 123
 *       '400':
 *         description: Bad request
 */
router.post('/register', MeterController.createMeter);
router.put('/snid/:snid', MeterController.updateMeter);
router.delete('/snid/:snid', MeterController.deleteMeter);

module.exports = router;



