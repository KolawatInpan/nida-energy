const express = require('express');
const router = express.Router();
const RunningMeterController = require('./runningMeter.service');

/**
 * @openapi
 * /api/runningMeters/create:
 *   post:
 *     summary: Create a running meter entry (ingest)
 *     tags:
 *       - RunningMeter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RunningMeterEntry'
 *     responses:
 *       '201':
 *         description: Entry created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 */
router.post('/create', RunningMeterController.createRunningEntry);

/**
 * @openapi
 * /api/runningMeters/generate-hourly:
 *   post:
 *     summary: Generate hourly entries from running data
 *     tags:
 *       - RunningMeter
 *     responses:
 *       '200':
 *         description: Generation started
 */
router.post('/generate-hourly', RunningMeterController.generateHourlyEntries);

/**
 * @openapi
 * /api/runningMeters/insert-log:
 *   post:
 *     summary: Insert a single running log
 *     tags:
 *       - RunningMeter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RunningMeterEntry'
 *     responses:
 *       '201':
 *         description: Log inserted
 */
router.post('/insert-log', RunningMeterController.insertRunningLog);

/**
 * @openapi
 * /api/runningMeters/insert-logs-bulk:
 *   post:
 *     summary: Bulk insert running logs
 *     tags:
 *       - RunningMeter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/RunningMeterEntry'
 *     responses:
 *       '201':
 *         description: Bulk insert accepted
 */
router.post('/insert-logs-bulk', RunningMeterController.insertRunningLogsBulk);

/**
 * @openapi
 * /api/runningMeters/reset-energy-logs:
 *   post:
 *     summary: Reset energy logs
 *     tags:
 *       - RunningMeter
 *     responses:
 *       '200':
 *         description: Reset completed
 */
router.post('/reset-energy-logs', RunningMeterController.resetEnergyLogs);

/**
 * GET /api/runningMeters/status
 * Returns cron schedule, number of auto-mock meters, current server time, and last running entry timestamp
 */
router.get('/status', RunningMeterController.getStatus);

/**
 * POST /api/runningMeters/backfill
 * body: { start: ISOString, end?: ISOString, delayMs?: number }
 * Starts backfill in background (spawns detached process) and returns pid.
 */
router.post('/backfill', RunningMeterController.backfill);

/**
 * GET /api/runningMeters/backfill-status?pid=<pid>
 * Returns JSON status file for running backfill processes (or latest if pid omitted)
 */
router.get('/backfill-status', RunningMeterController.backfillStatus);

/**
 * GET /api/runningMeters/battery-charge-sources/:snid?days=7
 * Returns battery charge source breakdown (aggregated kWh by source for kW > 0)
 */
router.get('/battery-charge-sources/:snid', RunningMeterController.getBatteryChargeSources);

module.exports = router;



