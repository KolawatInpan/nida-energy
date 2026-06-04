const cron = require('node-cron');
const marketService = require('./market.service');
const tradeEngine = require('./trade.engine');
const { prisma } = require('../../utils/prisma');

function initTradingCron() {
    // 1. ระบบ Auto-Trade (เวลา 15:00 น.)
    // สแกนตึกที่กำหนดโหมดการเทรด (ไม่ใช่ MANUAL) แล้วรันกฎอัตโนมัติ (Solar/Battery)
    // รองรับทั้ง legacy tradeMode และ per-asset solarTradeMode / batteryTradeMode
    cron.schedule('0 15 * * *', async () => {
        console.log('[CRON] Executing Auto-Trade Scanner for all buildings (15:00 PM)');
        try {
            const autoBuildings = await prisma.building.findMany({
                where: {
                    OR: [
                        { tradeMode: { not: 'MANUAL' } },
                        { solarTradeMode: { in: ['SELF_CONSUME', 'AUTO'] } },
                        { batteryTradeMode: { in: ['SELF_CONSUME', 'AUTO_BATTERY_THRESHOLD'] } },
                    ]
                }
            });

            for (const building of autoBuildings) {
                try {
                    const result = await tradeEngine.autoExecuteTradingForBuilding(building.name);
                    if (result.acted) {
                        console.log(`[AutoTrade] Actions for ${building.name}:`, result.actions);
                    }
                    // Also check battery surplus for auto-sell
                    const surplusResult = await tradeEngine.autoPostBatterySurplusOffer(building.name);
                    if (surplusResult.created) {
                        console.log(`[AutoTrade] Battery surplus sold for ${building.name}:`, surplusResult.reason);
                    }
                } catch (e) {
                    console.warn('[AutoTrade] error for', building.name, e.message || e);
                }
            }
        } catch (error) {
            console.error('[CRON] Auto-Trade Scanner Failed:', error);
        }
    });

    // 18:00 - Lock Day-Ahead submissions for tomorrow (create a locked run)
    cron.schedule('0 18 * * *', async () => {
        console.log('[CRON] Locking Day-Ahead submissions for tomorrow (18:00)');
        try {
            await marketService.preMatchLock();
        } catch (error) {
            console.error('[CRON] preMatchLock failed:', error);
        }
    });

    // 00:00 - Run matching for Day-Ahead (midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Executing Day-Ahead Market Clearing (00:00)');
        try {
            await marketService.executeMarketClearing();
        } catch (error) {
            console.error('[CRON] Market Clearing Failed:', error);
        }
    });

    // 05:00 - Finalize/Clear market run
    cron.schedule('0 5 * * *', async () => {
        console.log('[CRON] Finalizing Day-Ahead Market Run (05:00)');
        try {
            // find last running or locked run
            const run = await prisma.marketRun.findFirst({ orderBy: { createdAt: 'desc' } });
            if (run) await marketService.finalizeRun(run.id);
        } catch (error) {
            console.error('[CRON] Finalize run failed:', error);
        }
    });

    // 06:00 - Open market for the next day
    cron.schedule('0 6 * * *', async () => {
        console.log('[CRON] Opening Day-Ahead Market for next day (06:00)');
        try {
            await marketService.openMarketForDay();
        } catch (error) {
            console.error('[CRON] openMarketForDay failed:', error);
        }
    });
    console.log('[SYSTEM] Trading Cron Jobs initialized.');
}

module.exports = { initTradingCron };