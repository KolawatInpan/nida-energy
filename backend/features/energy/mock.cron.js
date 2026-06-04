const cron = require('node-cron');
const { prisma } = require('../../utils/prisma');

function initMockEnergyCron() {
    const scheduleExpr = process.env.MOCK_ENERGY_CRON || '0 * * * *';
    console.log('[CRON] Mock Energy schedule:', scheduleExpr);
    cron.schedule(scheduleExpr, async () => {
        console.log('[CRON] Executing Auto Mock Energy Generator');
        try {
            const activeMeters = await prisma.meterInfo.findMany({
                where: { isAutoMock: true }
            });

            if (activeMeters.length === 0) return;

            const now = new Date();
            const end = new Date(now);
            const start = new Date(now);
            start.setHours(start.getHours() - 1);
            start.setMinutes(0, 0, 0);
            end.setMinutes(0, 0, 0);

            // Phase 1: Inject energy data into RunningMeter
            for (const meter of activeMeters) {
                try {
                    const payload = {
                        snid: meter.snid,
                        start: start.toISOString(),
                        end: end.toISOString(),
                        intervalHours: 1,
                        valueProfile: meter.mockProfile || 'sinusoidal',
                        startingKwh: meter.kWH ? Number(meter.kWH) : 1000
                    };

                    const PORT = process.env.PORT || 8000;
                    const response = await fetch(`http://localhost:${PORT}/api/runningMeters/generate-hourly`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) console.log(`[CRON] Mocked 1h for ${meter.snid}`);
                } catch (err) {
                    console.error(`[CRON] Error mocking ${meter.snid}:`, err.message);
                }
            }

            // Phase 2: Sync energy → update meter kWh from RunningMeter, then check battery threshold & auto-trade
            const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');
            const { autoExecuteTradingForBuilding } = require('../trading/trade.engine');

            // Collect unique buildings from auto-mock meters
            const buildingNames = [...new Set(activeMeters.map(m => m.buildingName).filter(Boolean))];

            for (const bName of buildingNames) {
                try {
                    // Sync energy: update meter kWh values from RunningMeter data
                    await syncBuildingEnergyForBuilding(bName);
                    console.log(`[CRON] Synced energy for ${bName}`);

                    // Check battery threshold & auto-trade
                    const building = await prisma.building.findUnique({ where: { name: bName } });
                    if (!building) continue;

                    const batteryMeter = await prisma.meterInfo.findFirst({
                        where: { buildingName: bName, type: { contains: 'battery', mode: 'insensitive' } },
                        select: { kWH: true, capacity: true },
                    });

                    if (!batteryMeter || !batteryMeter.capacity) {
                        console.log(`[CRON] ${bName}: no battery meter, skipping auto-trade`);
                        continue;
                    }

                    const currentKwh = Number(batteryMeter.kWH || 0);
                    const capacity = Number(batteryMeter.capacity || 0);
                    const thresholdPct = Number(building.batterySellThreshold != null ? building.batterySellThreshold : 80);
                    const thresholdKwh = (capacity * thresholdPct) / 100;
                    const batteryPct = capacity > 0 ? Math.round((currentKwh / capacity) * 100) : 0;

                    const tradeMode = String(building.tradeMode || building.batteryTradeMode || 'MANUAL').toUpperCase();
                    const shouldAutoTrade = tradeMode === 'AUTO_BATTERY_THRESHOLD' || tradeMode === 'AUTO_TRADE';

                    console.log(`[CRON] ${bName}: battery ${currentKwh.toFixed(1)}/${capacity.toFixed(0)} kWh (${batteryPct}%), threshold ${thresholdPct}% (${thresholdKwh.toFixed(0)} kWh), mode: ${tradeMode}`);

                    if (shouldAutoTrade && currentKwh > thresholdKwh) {
                        const excess = currentKwh - thresholdKwh;
                        console.log(`[CRON] ${bName}: battery ABOVE threshold (excess: ${excess.toFixed(1)} kWh) → triggering auto-trade`);
                        const result = await autoExecuteTradingForBuilding(bName);
                        console.log(`[CRON] ${bName} auto-trade result:`, JSON.stringify(result));
                    } else if (!shouldAutoTrade) {
                        console.log(`[CRON] ${bName}: manual mode, skipping auto-trade`);
                    } else {
                        console.log(`[CRON] ${bName}: battery below threshold (${currentKwh.toFixed(1)} < ${thresholdKwh.toFixed(0)}), no sell`);
                    }
                } catch (err) {
                    console.error(`[CRON] Error in threshold check for ${bName}:`, err.message);
                }
            }
        } catch (error) {
            console.error('[CRON] Auto Mock Energy Generator Failed:', error);
        }
    });
    console.log('[SYSTEM] Mock Energy Cron Job initialized (with threshold auto-trade).');
}

module.exports = { initMockEnergyCron };