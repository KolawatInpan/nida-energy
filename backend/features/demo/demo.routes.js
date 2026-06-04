const express = require('express');
const router = express.Router();
const DemoController = require('./demo.controller');
const marketService = require('../trading/market.service');
const { testMeterInactiveNotification } = require('../energy/meterMonitor.cron');

// POST /api/demo/cycle — Run full market cycle
router.post('/cycle', DemoController.runDemoCycle);

// POST /api/demo/clearing — Public Day-Ahead clearing trigger (defaults to today)
router.post('/clearing', async (req, res) => {
    try {
        const targetDate = req.body?.targetDate || new Date();
        const result = await marketService.executeMarketClearing(targetDate);
        
        // Gather match details
        const { prisma } = require('../../utils/prisma');
        const matches = result?.id 
            ? await prisma.marketMatch.findMany({ where: { runId: result.id } })
            : await prisma.marketMatch.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
        
        const forcedTxns = await prisma.transaction.count({
            where: { type: { contains: 'FORCED_DISTRIBUTION' } },
        });

        res.json({ 
            success: true, 
            runId: result?.id || null,
            status: result?.status || 'completed',
            matchCount: matches.length,
            forcedDistributions: forcedTxns,
            forceDistribution: result?.forceDistribution || null,
            priorityTable: result?.forceDistribution?.priorityTable || [],
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/demo/test-meter-notify — Test meter inactive Telegram notification
router.post('/test-meter-notify', async (req, res) => {
    try {
        const result = await testMeterInactiveNotification();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/demo/mock-auto-trade — Trigger mock energy injection + threshold auto-trade for a building
router.post('/mock-auto-trade', async (req, res) => {
    try {
        const { buildingName } = req.body;
        if (!buildingName) return res.status(400).json({ error: 'buildingName required' });

        const { prisma } = require('../../utils/prisma');
        const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');
        const { autoExecuteTradingForBuilding } = require('../trading/trade.engine');

        // Sync energy first
        await syncBuildingEnergyForBuilding(buildingName);

        // Get building & battery status
        const building = await prisma.building.findUnique({ where: { name: buildingName } });
        if (!building) return res.status(404).json({ error: 'Building not found' });

        const batteryMeter = await prisma.meterInfo.findFirst({
            where: { buildingName, type: { contains: 'battery', mode: 'insensitive' } },
            select: { kWH: true, capacity: true },
        });

        const currentKwh = batteryMeter ? Number(batteryMeter.kWH || 0) : 0;
        const capacity = batteryMeter ? Number(batteryMeter.capacity || 0) : 0;
        const thresholdPct = Number(building.batterySellThreshold != null ? building.batterySellThreshold : 80);
        const thresholdKwh = (capacity * thresholdPct) / 100;
        const batteryPct = capacity > 0 ? Math.round((currentKwh / capacity) * 100) : 0;
        const aboveThreshold = currentKwh > thresholdKwh;

        let tradeResult = null;
        if (aboveThreshold) {
            tradeResult = await autoExecuteTradingForBuilding(buildingName);
        }

        res.json({
            success: true,
            building: buildingName,
            battery: { currentKwh: Math.round(currentKwh), capacity: Math.round(capacity), pct: batteryPct },
            threshold: { pct: thresholdPct, kwh: Math.round(thresholdKwh) },
            aboveThreshold,
            tradeTriggered: !!tradeResult,
            tradeResult,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
