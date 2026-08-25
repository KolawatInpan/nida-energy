// Notification service: สร้าง notification ตาม event ต่างๆ
const { prisma } = require('../../utils/prisma');
const { isNotificationEnabled } = require('./notification.types');

/**
 * สร้าง notification
 * @param {Object} param0
 * @param {string} param0.type - ประเภท event เช่น 'building_added', 'meter_added', 'user_registered', 'sell_electricity', 'invoice', 'topup', 'topup_success', 'payment_success'
 * @param {string} param0.message - ข้อความแจ้งเตือน
 * @param {string} [param0.email] - email ของผู้รับโดยตรง (ใช้ค่านี้ก่อน ถ้ามี)
 * @param {string} [param0.userId] - user credId (ใช้หา email ถ้าไม่ระบุ email โดยตรง)
 * @param {number} [param0.buildingId]
 * @param {number} [param0.meterId]
 */
async function createNotification({ type, message, email: directEmail = null, userId = null, buildingId = null, meterId = null }) {
  let email = directEmail || 'admin';
  if (!directEmail && userId) {
    const user = await prisma.user.findUnique({ where: { credId: String(userId) } });
    if (user && user.email) {
      email = user.email;
    }
  }

  return prisma.notification.create({
    data: {
      email,
      title: type || 'System Notification',
      body: message || '',
      data: { type, userId, buildingId, meterId },
      read: false
    },
  });
}

/**
 * Dispatch a notification through the channels the user has enabled:
 *  - Always: in-app notification (DB)
 *  - If notifyTelegram + telegramChatId: Telegram direct message
 *  - If notifyEmail + email: Email
 * All outbound sends are fire-and-forget (never block / throw to caller).
 *
 * @param {Object} param0
 * @param {string} param0.type - event type
 * @param {string} param0.message - message text (also used for Telegram/Email body)
 * @param {string} [param0.email] - recipient email (used to find the user & send email)
 * @param {string} [param0.userId] - user credId
 * @param {number} [param0.buildingId]
 * @param {number} [param0.meterId]
 * @param {string} [param0.channel] - 'all' | 'telegram' | 'email' (default 'all')
 */
async function dispatchNotification({ type, message, email: directEmail = null, userId = null, buildingId = null, meterId = null, channel = 'all' }) {
  // 1. Resolve the recipient user (prefer explicit userId, else directEmail)
  let user = null;
  if (userId) {
    user = await prisma.user.findUnique({ where: { credId: String(userId) } }).catch(() => null);
  }
  if (!user && directEmail) {
    user = await prisma.user.findUnique({ where: { email: directEmail } }).catch(() => null);
  }
  const userEmail = user?.email || directEmail || null;

  // 0. Preference gate: skip outbound channels if this type is disabled for the user.
  //    In-app notification is always created regardless of type preference.
  const typeEnabled = isNotificationEnabled(user, type);

  // 2. Always create the in-app notification
  try {
    await createNotification({ type, message, email: userEmail, userId, buildingId, meterId });
  } catch (e) {
    console.error('[dispatchNotification] in-app create failed:', e.message);
  }

  if (!typeEnabled) {
    return { userId: user?.credId || null, email: userEmail, telegram: false, emailSent: false, typeDisabled: true };
  }

  // 3. Telegram (if enabled + has chat id)
  const wantTelegram = channel === 'all' || channel === 'telegram';
  if (wantTelegram && user?.notifyTelegram !== false && user?.telegramChatId) {
    try {
      const { sendTelegramMessage } = require('../../utils/telegram');
      await sendTelegramMessage({ text: message, parseMode: 'HTML', chatId: user.telegramChatId });
    } catch (e) {
      console.error('[dispatchNotification] Telegram failed:', e.message);
    }
  }

  // 4. Email (if enabled + has email)
  const wantEmail = channel === 'all' || channel === 'email';
  if (wantEmail && user?.notifyEmail !== false && userEmail) {
    try {
      const { sendEmail } = require('../../utils/email');
      await sendEmail({
        to: userEmail,
        subject: `[NIDA Energy] ${type}`,
        html: `<div style="font-family:Arial,sans-serif"><h3>${type}</h3><p>${message}</p></div>`,
      });
    } catch (e) {
      console.error('[dispatchNotification] Email failed:', e.message);
    }
  }

  return { userId: user?.credId || null, email: userEmail, telegram: user?.notifyTelegram !== false && !!user?.telegramChatId, emailSent: user?.notifyEmail !== false && !!userEmail };
}

/**
 * ดึง notification สำหรับ user หรือ admin
 * @param {number|null} userId - ถ้า null = admin, ถ้า userId = เฉพาะ user
 * @param {number} [limit=20]
 */
async function getNotifications(userId = null, limit = 20) {
  let filter = {};
  
  if (userId) {
    if (String(userId).includes('@')) {
      filter.email = String(userId);
    } else {
      const user = await prisma.user.findUnique({ where: { credId: String(userId) } });
      if (user && user.email) {
        filter.email = user.email;
      } else {
        filter.email = 'not-found'; // หากไม่พบ User จะไม่แสดงแจ้งเตือน
      }
    }
  }

  return prisma.notification.findMany({
    where: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Mark a notification as read
 */
async function markAsRead(notificationId) {
  return prisma.notification.update({
    where: { id: Number(notificationId) },
    data: { read: true },
  });
}

module.exports = {
  createNotification,
  dispatchNotification,
  getNotifications,
  markAsRead,
};
