const express = require("express");
const router = express.Router();
const BuildingController = require("../controllers/building.controller");


router.get("/", BuildingController.getBuildings);
router.get("/:id", BuildingController.getBuilding);
router.get("/:buildingId/meters/count", BuildingController.getTotalMeters);

module.exports = router;
