const express = require("express");
const router = express.Router();
const BuildingController = require("./building.controller");

/**
 * @openapi
 * /buildings:
 *   get:
 *     summary: Get list of buildings
 *     tags:
 *       - Building
 *     responses:
 *       '200':
 *         description: Array of buildings
 */
router.get("/", BuildingController.getBuildings);

/**
 * @openapi
 * /buildings/{id}:
 *   get:
 *     summary: Get building by id
 *     tags:
 *       - Building
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Building object
 *       '404':
 *         description: Building not found
 */
router.get("/:id", BuildingController.getBuilding);

/**
 * @openapi
 * /buildings/{buildingId}/meters/count:
 *   get:
 *     summary: Get total meters count for a building
 *     tags:
 *       - Building
 *     parameters:
 *       - name: buildingId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: { totalMeters: number }
 */
router.get("/:buildingId/meters/count", BuildingController.getTotalMeters);

/**
 * @openapi
 * /buildings/email/{email}:
 *   get:
 *     summary: Get building by owner email
 *     tags:
 *       - Building
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Building object
 *       '404':
 *         description: Building not found
 */
router.get("/email/:email", BuildingController.getBuildingByEmail);

/**
 * @openapi
 * /buildings/register:
 *   post:
 *     summary: Create a new building
 *     tags:
 *       - Building
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               mapURL:
 *                 type: string
 *               address:
 *                 type: string
 *               province:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Building created
 *       '400':
 *         description: Validation error
 */
router.post("/register", BuildingController.createBuilding);
router.put("/:id", BuildingController.updateBuilding);
router.delete("/:id", BuildingController.deleteBuilding);

module.exports = router;



