const express = require("express");
const router = express.Router();
const DashboardController = require("./dashboard.controller");

router.get("/getBuildingById", DashboardController.getBuildingByMeterId);
router.get("/getMeterTypeById", DashboardController.getMeterTypeByMeterId);
router.get("/getAllMetersByBuildingName", DashboardController.getAllMetersByBuildingName);
router.get("/getTypeAndBuildingByMeterId", DashboardController.getTypeAndBuildingByMeterId);

router.get("/getAllConsumeMeters", DashboardController.getAllConsumptionMeters);
router.get("/getAllProduceMeters", DashboardController.getAllProducerMeters);
router.get("/getAllBatteryMeters", DashboardController.getAllBatteryMeters);
router.get("/hourly", DashboardController.getHourlyEnergy);
router.get("/daily", DashboardController.getDailyEnergy);
router.get("/weekly", DashboardController.getWeeklyEnergy);
router.get("/monthly", DashboardController.getMonthlyEnergy);
router.get("/search", DashboardController.searchBuildingEnergy);


module.exports = router;



