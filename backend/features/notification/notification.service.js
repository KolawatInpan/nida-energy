// Notification service: สร้าง notification ตาม event ต่างๆ
const { prisma } = require('../../utils/prisma');
const {
  isNotificationEnabled,
  NOTIFICATION_TYPE_LABELS,
  categorizeType,
} = require('./notification.types');

/**
 * Human-readable label for a raw event type, resolved through the notification type
 * registry so the subject line never leaks an internal key like "topup_success".
 */
function notificationLabel(type) {
  return NOTIFICATION_TYPE_LABELS[categorizeType(type)] || 'Notification';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the notification email body.
 *
 * Senders pass plain text containing real newlines (invoice/topup messages are
 * multi-line). HTML collapses those, so they are converted to <br> and the whole
 * message is escaped — otherwise a building name with an ampersand would break the
 * markup, and a crafted value could inject tags.
 */
function buildNotificationEmail({ type, message, recipientName = null }) {
  const label = notificationLabel(type);
  const greeting = recipientName ? `Hello ${escapeHtml(recipientName)},` : 'Hello,';
  const bodyHtml = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const stamp = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:#1d4ed8;color:#ffffff;padding:16px 20px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">NIDA Energy Trading</div>
      <div style="font-size:13px;opacity:0.85">${escapeHtml(label)}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 12px 12px">
      <p style="margin:0 0 12px">${greeting}</p>
      <div style="background:#f9fafb;border-left:3px solid #1d4ed8;padding:12px 14px;border-radius:6px;line-height:1.6">${bodyHtml}</div>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280">${escapeHtml(stamp)} (Asia/Bangkok)</p>
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:12px">This is an automated message from NIDA Energy Trading. Please do not reply.</p>
  </div>`;

  const text = [
    `NIDA Energy Trading — ${label}`,
    '',
    greeting,
    '',
    String(message || ''),
    '',
    `${stamp} (Asia/Bangkok)`,
  ].join('\n');

  return { subject: `[NIDA Energy] ${label}`, html, text };
}

/**
 * สร้าง notification
 * @param {Object} param0
 * @param {string} param0.type - ประเภท event เช่น 'building_added', 'meter_added', 'user_registered', 'sell_electricity', 'invoice', 'topup', 'topup_success', 'payment_success'
 * @param {string} param0.message - ข้อความแจ้งเตือน
 * @param {string} [param0.userId] - user credId
 * @param {number} [param0.buildingId]
 * @param {number} [param0.meterId]
 */
async function createNotification({ type, message, userId = null, buildingId = null, meterId = null }) {
  return prisma.notification.create({
    data: {
      userId: userId || null,
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
 *  - If notifyEmail + email: Email (email is the only outbound channel)
 * All outbound sends are fire-and-forget (never block / throw to caller).
 *
 * @param {Object} param0
 * @param {string} param0.type - event type
 * @param {string} param0.message - message text (also used for the Email body)
 * @param {string} [param0.userId] - user credId
 * @param {number} [param0.buildingId]
 * @param {number} [param0.meterId]
 * @param {string} [param0.channel] - 'all' | 'email' (default 'all')
 *
 * When `userId` is null/unknown (admin & global events) there is no user to read an
 * email from. In that case the email goes to ADMIN_EMAIL instead, so global events
 * (topup, addBalance, user_registered, ...) still reach a real inbox.
 */
async function dispatchNotification({ type, message, userId = null, buildingId = null, meterId = null, channel = 'all' }) {
  // 1. Resolve the recipient user by userId (credId)
  let user = null;
  if (userId) {
    user = await prisma.user.findUnique({ where: { credId: String(userId) } }).catch(() => null);
  }

  // Admin / global events are dispatched with userId = null. For in-app that already
  // means "visible to all admins" (see getNotifications). Mirror that for email so
  // these events are not silently dropped before reaching the email channel.
  const adminEmail = process.env.ADMIN_EMAIL || 'blockchain.admin@nida.ac.th';
  const adminFallback = !user && !!adminEmail;

  const userEmail = user?.email || (adminFallback ? adminEmail : null);

  // 0. Preference gate: skip outbound channels if this type is disabled for the user.
  //    In-app notification is always created regardless of type preference.
  const typeEnabled = isNotificationEnabled(user, type);

  // 2. Always create the in-app notification
  try {
    await createNotification({ type, message, userId, buildingId, meterId });
  } catch (e) {
    console.error('[dispatchNotification] in-app create failed:', e.message);
  }

  if (!typeEnabled) {
    return { userId: user?.credId || null, email: userEmail, emailSent: false, typeDisabled: true, adminFallback };
  }

  // 3. Email (if enabled + has email) — the only outbound channel
  const wantEmail = channel === 'all' || channel === 'email';
  if (wantEmail && user?.notifyEmail !== false && userEmail) {
    try {
      const { sendEmail } = require('../../utils/email');
      const mail = buildNotificationEmail({
        type,
        message,
        // Admin fallback has no user row to read a name from.
        recipientName: user?.name || (adminFallback ? 'Admin' : null),
      });
      await sendEmail({
        to: userEmail,
        fromName: 'NIDA Energy Trading',
        ...mail,
      });
    } catch (e) {
      console.error('[dispatchNotification] Email failed:', e.message);
    }
  }

  return { userId: user?.credId || null, email: userEmail, emailSent: user?.notifyEmail !== false && !!userEmail, adminFallback };
}

/**
 * ดึง notification สำหรับ user หรือ admin
 * @param {number|null} userId - ถ้า null = admin, ถ้า userId = เฉพาะ user
 * @param {number} [limit=20]
 */
async function getNotifications(userId = null, limit = 20) {
  let filter = {};
  
  if (userId) {
    filter.userId = String(userId);
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
