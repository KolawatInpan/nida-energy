const DashBoardModel = require('./dashboard.model');
// Use model for DB work

async function getBuildingByMeterId(req, res) {
    const { meterId } = req.query;
    if (!meterId) {
        return res.status(400).json({ error: 'meterId query parameter is required' });
    }
    try {
        const building = await DashBoardModel.getBuildingByMeterId(meterId);
        if (!building) {
            return res.status(404).json({ error: 'Building not found for the given meterId' });
        }
        res.json(building);
    } catch (error) {
        console.error('Error fetching building by meterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMeterTypeByMeterId(req, res) {
    const { meterId } = req.query;
    if (!meterId) {
        return res.status(400).json({ error: 'meterId query parameter is required' });
    }
    try {
        const meterType = await DashBoardModel.getMeterTypeByMeterId(meterId);
        if (!meterType) {
            return res.status(404).json({ error: 'Meter not found for the given meterId' });
        }
        res.json(meterType);
    } catch (error) {
        console.error('Error fetching meter type by meterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getAllMetersByBuildingName(req, res) {
    const { buildingName } = req.query;
    if (!buildingName) {
        return res.status(400).json({ error: 'buildingName query parameter is required' });
    }
    try {
        const meters = await DashBoardModel.getAllMetersByBuildingName(buildingName);
        res.json(meters);
    } catch (error) {
        console.error('Error fetching meters by buildingName:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getTypeAndBuildingByMeterId(req, res) {
    const { meterId } = req.query;
    if (!meterId) {
        return res.status(400).json({ error: 'meterId query parameter is required' });
    }
    try {
        const result = await DashBoardModel.getTypeAndBuildingByMeterId(meterId);
        if (!result) {
            return res.status(404).json({ error: 'Meter not found for the given meterId' });
        }
        res.json(result);
    } catch (error) {
        console.error('Error fetching type and building by meterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getAllConsumptionMeters(req, res) {
    try {
        const meters = await DashBoardModel.getAllConsumptionMeters();
        res.json(meters);
    } catch (error) {
        console.error('Error fetching all consumption meters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getAllProducerMeters(req, res) {
    try {
        const meters = await DashBoardModel.getAllProducerMeters();
        res.json(meters);
    } catch (error) {
        console.error('Error fetching all producer meters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getAllBatteryMeters(req, res) {
    try {
        const meters = await DashBoardModel.getAllBatteryMeters();
        res.json(meters);
    } catch (error) {
        console.error('Error fetching all battery meters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getHourlyEnergy(req, res) {
    try {
        const { meterId, date } = req.query;
        const rows = await DashBoardModel.getHourlyEnergy({ meterId, date });
        res.json(rows);
    } catch (err) {
        console.error('Error fetching hourly energy:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getDailyEnergy(req, res) {
    try {
        const { meterId, monthId, month, year } = req.query;
        const rows = await DashBoardModel.getDailyEnergy({ meterId, monthId, month, year });
        res.json(rows);
    } catch (err) {
        console.error('Error fetching daily energy:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getWeeklyEnergy(req, res) {
    try {
        const { meterId, weekId, week, year } = req.query;
        const rows = await DashBoardModel.getWeeklyEnergy({ meterId, weekId, week, year });
        res.json(rows);
    } catch (err) {
        console.error('Error fetching weekly energy:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMonthlyEnergy(req, res) {
    try {
        const { meterId, year } = req.query;
        const rows = await DashBoardModel.getMonthlyEnergy({ meterId, year });
        res.json(rows);
    } catch (err) {
        console.error('Error fetching monthly energy:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function searchBuildingEnergy(req, res) {
        try {
                const { building, start, end, timeunit } = req.query;
                const result = await DashBoardModel.searchBuildingEnergy({ building, start, end, timeunit });
                return res.json({ result: 'success', building, ...result });
        } catch (err) {
                console.error('searchBuildingEnergy error', err);
                return res.status(500).json({ error: err.message });
        }
}


module.exports = {
    getBuildingByMeterId,
    getMeterTypeByMeterId,
    getAllMetersByBuildingName,
    getTypeAndBuildingByMeterId,
    getAllConsumptionMeters,
    getAllProducerMeters,
    getAllBatteryMeters,
    getHourlyEnergy,
    getDailyEnergy,
    getWeeklyEnergy,
    getMonthlyEnergy,
    searchBuildingEnergy,
}


