const express = require("express");
const router = express.Router();
const DashboardController = require("./dashboard.controller");

/**
 * @openapi
 * /api/dashboard/getBuildingById:
 *   get:
 *     summary: Get building by meter id
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Building data
 */
router.get("/getBuildingById", DashboardController.getBuildingByMeterId);

/**
 * @openapi
 * /api/dashboard/getMeterTypeById:
 *   get:
 *     summary: Get meter type by meter id
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Meter type
 */
router.get("/getMeterTypeById", DashboardController.getMeterTypeByMeterId);

/**
 * @openapi
 * /api/dashboard/getAllMetersByBuildingName:
 *   get:
 *     summary: Get all meters for a building (by name)
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Array of meters
 */
router.get("/getAllMetersByBuildingName", DashboardController.getAllMetersByBuildingName);

/**
 * @openapi
 * /api/dashboard/getTypeAndBuildingByMeterId:
 *   get:
 *     summary: Get type and building by meter id
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Type and building
 */
router.get("/getTypeAndBuildingByMeterId", DashboardController.getTypeAndBuildingByMeterId);

/**
 * @openapi
 * /api/dashboard/getAllConsumeMeters:
 *   get:
 *     summary: Get all consumption meters
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Array of consumption meters
 */
router.get("/getAllConsumeMeters", DashboardController.getAllConsumptionMeters);

/**
 * @openapi
 * /api/dashboard/getAllProduceMeters:
 *   get:
 *     summary: Get all producer meters
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Array of producer meters
 */
router.get("/getAllProduceMeters", DashboardController.getAllProducerMeters);

/**
 * @openapi
 * /api/dashboard/getAllBatteryMeters:
 *   get:
 *     summary: Get all battery meters
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Array of battery meters
 */
router.get("/getAllBatteryMeters", DashboardController.getAllBatteryMeters);

/**
 * @openapi
 * /api/dashboard/hourly:
 *   get:
 *     summary: Hourly aggregated energy
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Hourly energy data
 */
router.get("/hourly", DashboardController.getHourlyEnergy);

/**
 * @openapi
 * /api/dashboard/daily:
 *   get:
 *     summary: Daily aggregated energy
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Daily energy data
 */
router.get("/daily", DashboardController.getDailyEnergy);

/**
 * @openapi
 * /api/dashboard/weekly:
 *   get:
 *     summary: Weekly aggregated energy
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Weekly energy data
 */
router.get("/weekly", DashboardController.getWeeklyEnergy);

/**
 * @openapi
 * /api/dashboard/monthly:
 *   get:
 *     summary: Monthly aggregated energy
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Monthly energy data
 */
router.get("/monthly", DashboardController.getMonthlyEnergy);

/**
 * @openapi
 * /api/dashboard/search:
 *   get:
 *     summary: Search building energy
 *     tags:
 *       - Dashboard
 *     responses:
 *       '200':
 *         description: Search results
 */
router.get("/search", DashboardController.searchBuildingEnergy);

/**
 * Examples:
 * /dashboard/hourly response:
 *   application/json:
 *     { "data": [{"buildingId":1,"hour":"2026-04-17T10:00:00Z","kwh":12.3}] }
 * /dashboard/daily response:
 *   application/json:
 *     { "data": [{"buildingId":1,"date":"2026-04-17","kwh":123.4}] }
 */


module.exports = router;



