const cron = require('node-cron');
const { sendTelegramMessage } = require('../../utils/telegram');

/**
 * Check for inactive meters (no RunningMeter data in last N hours)
 * and send Telegram notifications.
 */
const INACTIVE_HOURS = 24; // meters inactive for 24+ hours
const CRON_SCHEDULE = '0 * * * *'; // every hour

let notifiedMeters = new Set(); // track already-notified meters to avoid spam

function startMeterMonitor() {
  console.log(`[MeterMonitor] Starting inactive meter check every hour (threshold: ${INACTIVE_HOURS}h)`);

  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      // Lazy require prisma to avoid circular deps at startup
      const { prisma } = require('../../utils/prisma');

      const cutoff = new Date(Date.now() - INACTIVE_HOURS * 60 * 60 * 1000);

      // Get all approved meters
      const allMeters = await prisma.meterInfo.findMany({
        where: { approveStatus: 'approved' },
        select: { snid: true, type: true, buildingName: true },
      });

      if (!allMeters.length) return;

      // Find the latest RunningMeter entry for each snid
      const latestEntries = await prisma.runningMeter.groupBy({
        by: ['snid'],
        _max: { timestamp: true },
      });

      const latestMap = new Map();
      for (const e of latestEntries) {
        latestMap.set(e.snid, e._max.timestamp);
      }

      const now = Date.now();
      const inactiveMeters = allMeters.filter(m => {
        const lastTs = latestMap.get(m.snid);
        if (!lastTs) return true; // never sent data
        return new Date(lastTs).getTime() < cutoff.getTime();
      });

      // Reset notified list daily
      if (now - (global._meterNotifyReset || 0) > 24 * 60 * 60 * 1000) {
        notifiedMeters.clear();
        global._meterNotifyReset = now;
      }

      // Notify for newly inactive meters
      for (const m of inactiveMeters) {
        const key = m.snid;
        if (notifiedMeters.has(key)) continue;

        notifiedMeters.add(key);
        const lastData = latestMap.get(m.snid);
        const lastStr = lastData
          ? new Date(lastData).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
          : 'ไม่เคยส่งข้อมูล';

        const text = [
          `⚠️ <b>Meter Inactive</b>`,
          `🏢 อาคาร: ${m.buildingName || 'Unknown'}`,
          `📟 SNID: ${m.snid}`,
          `🔌 ประเภท: ${m.type || 'Unknown'}`,
          `🕐 ข้อมูลล่าสุด: ${lastStr}`,
          `⏰ ไม่มีข้อมูลมาเกิน ${INACTIVE_HOURS} ชั่วโมง`,
        ].join('\n');

        try {
          await sendTelegramMessage({ text, parseMode: 'HTML' });
          console.log(`[MeterMonitor] Notified: ${m.snid} (${m.buildingName})`);
        } catch (e) {
          console.error(`[MeterMonitor] Telegram failed for ${m.snid}:`, e?.message || e);
        }
      }

      // Clear notified for meters that became active again
      for (const m of allMeters) {
        const lastTs = latestMap.get(m.snid);
        if (lastTs && new Date(lastTs).getTime() >= cutoff.getTime()) {
          notifiedMeters.delete(m.snid);
        }
      }

      if (inactiveMeters.length > 0) {
        console.log(`[MeterMonitor] Found ${inactiveMeters.length} inactive meters`);
      }
    } catch (err) {
      console.error('[MeterMonitor] Error:', err.message || err);
    }
  });
}

/**
 * Test: send a sample meter inactive Telegram notification using the first approved meter.
 */
async function testMeterInactiveNotification() {
  const { prisma } = require('../../utils/prisma');
  const meters = await prisma.meterInfo.findMany({
    where: { approveStatus: 'approved' },
    take: 1,
    select: { snid: true, type: true, buildingName: true },
  });

  if (!meters.length) {
    throw new Error('No approved meters found for test notification');
  }

  const m = meters[0];
  const lastRow = await prisma.runningMeter.findFirst({
    where: { snid: m.snid },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });

  const lastStr = lastRow?.timestamp
    ? new Date(lastRow.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    : 'ไม่เคยส่งข้อมูล';

  const text = [
    `🧪 <b>[TEST] Meter Inactive Notification</b>`,
    `🏢 อาคาร: ${m.buildingName || 'Unknown'}`,
    `📟 SNID: ${m.snid}`,
    `🔌 ประเภท: ${m.type || 'Unknown'}`,
    `🕐 ข้อมูลล่าสุด: ${lastStr}`,
    `⏰ แจ้งเตือนเมื่อไม่มีข้อมูลเกิน ${INACTIVE_HOURS} ชั่วโมง`,
  ].join('\n');

  await sendTelegramMessage({ text, parseMode: 'HTML' });
  return { sent: true, meter: m, lastData: lastStr };
}

module.exports = { startMeterMonitor, testMeterInactiveNotification };
