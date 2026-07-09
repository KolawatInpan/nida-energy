/**
 * backfillBatterySource.js
 * 1. Set source='SOLAR' on existing RunningMeter rows for battery meters where kW > 0.
 * 2. Clamp meter.kWH and meter.value to capacity (fix overflow from old mock data).
 * Run: node backend/tools/backfillBatterySource.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('[backfill] Finding battery meters...');
    
    const batteryMeters = await prisma.meterInfo.findMany({
        where: { type: { contains: 'battery', mode: 'insensitive' } },
        select: { snid: true, buildingName: true, capacity: true, kWH: true, value: true },
    });
    
    console.log(`[backfill] Found ${batteryMeters.length} battery meters`);
    
    let totalSourceUpdated = 0;
    let totalClamped = 0;
    
    for (const m of batteryMeters) {
        // 1. Backfill source
        const result = await prisma.runningMeter.updateMany({
            where: { snid: m.snid, kW: { gt: 0 }, source: null },
            data: { source: 'SOLAR' },
        });
        if (result.count > 0) {
            console.log(`  [source] ${m.snid}: ${result.count} rows updated`);
            totalSourceUpdated += result.count;
        }
        
        // 2. Clamp kWH/value to capacity
        const capacity = Number(m.capacity || 0);
        const currentKwh = Number(m.kWH || 0);
        const currentValue = Number(m.value || 0);
        if (capacity > 0 && (currentKwh > capacity || currentValue > capacity)) {
            const clamped = Math.min(currentKwh, currentValue, capacity);
            await prisma.meterInfo.update({
                where: { snid: m.snid },
                data: { kWH: clamped, value: clamped },
            });
            console.log(`  [clamp] ${m.snid}: ${currentKwh}/${currentValue} → ${clamped} (cap: ${capacity})`);
            totalClamped++;
        }
    }
    
    console.log(`[backfill] Done. Source: ${totalSourceUpdated}, Clamped: ${totalClamped}`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
