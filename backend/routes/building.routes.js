const express = require("express");
const router = express.Router();
const BuildingController = require("../controllers/building.controller");
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');

// CRUD routes
// allow optional auth for listing so frontend can pass token or not
router.get("/", optionalAuth, BuildingController.getBuildings);
router.get("/:id", BuildingController.getBuilding);
// allow optional auth for create so registration flow can include ownerId in body
router.post("/", optionalAuth, BuildingController.createBuilding);
router.put("/:id", auth, BuildingController.updateBuilding);
router.delete("/:id", auth, BuildingController.deleteBuilding);
// create meter under a building (allow optional auth to support registration flow)
router.post("/:id/meters", optionalAuth, BuildingController.createMeterForBuilding);

module.exports = router;
