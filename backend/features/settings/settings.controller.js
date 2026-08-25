/**
 * Settings Controller
 * Per-user settings endpoints. Currently supports Notification preferences.
 * Auth: current user is resolved from the JWT (req.user).
 */
const userService = require('../users/user.service');
const { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS, NOTIFY_NONE } = require('../notification/notification.types');

/** Resolve the current user's credId from the JWT payload. */
function resolveCredId(req) {
  const user = req.user || req.auth || {};
  return user.credId || user._id || user.id || user.userId || null;
}

/**
 * GET /api/settings/notification
 * Returns the current user's notification preferences.
 */
async function getNotificationSettings(req, res) {
  try {
    const credId = resolveCredId(req);
    if (!credId) return res.status(401).json({ error: 'Unauthorized — missing user identity' });

    const user = await userService.getUserById(credId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      telegramChatId: user.telegramChatId || null,
      notifyEmail: user.notifyEmail !== false,
      notifyTelegram: user.notifyTelegram !== false,
      notifyTypes: Array.isArray(user.notifyTypes) ? user.notifyTypes : [],
      notificationTypes: Object.values(NOTIFICATION_TYPES).map((key) => ({
        key,
        label: NOTIFICATION_TYPE_LABELS[key] || key,
      })),
      email: user.email || null,
    });
  } catch (err) {
    console.error('getNotificationSettings error', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/settings/notification
 * Updates the current user's notification preferences.
 * Body: { telegramChatId?, notifyEmail?, notifyTelegram?, notifyTypes? }
 */
async function updateNotificationSettings(req, res) {
  try {
    const credId = resolveCredId(req);
    if (!credId) return res.status(401).json({ error: 'Unauthorized — missing user identity' });

    const updates = {};
    if (req.body?.telegramChatId !== undefined) updates.telegramChatId = req.body.telegramChatId;
    if (req.body?.notifyEmail !== undefined) updates.notifyEmail = req.body.notifyEmail;
    if (req.body?.notifyTelegram !== undefined) updates.notifyTelegram = req.body.notifyTelegram;
    if (req.body?.notifyTypes !== undefined) {
      const validKeys = new Set([...Object.values(NOTIFICATION_TYPES), NOTIFY_NONE]);
      updates.notifyTypes = (Array.isArray(req.body.notifyTypes) ? req.body.notifyTypes : [])
        .map((t) => String(t))
        .filter((t) => validKeys.has(t));
    }

    const updated = await userService.updateUser(credId, updates);

    res.json({
      telegramChatId: updated.telegramChatId || null,
      notifyEmail: updated.notifyEmail !== false,
      notifyTelegram: updated.notifyTelegram !== false,
      notifyTypes: Array.isArray(updated.notifyTypes) ? updated.notifyTypes : [],
      notificationTypes: Object.values(NOTIFICATION_TYPES).map((key) => ({
        key,
        label: NOTIFICATION_TYPE_LABELS[key] || key,
      })),
      email: updated.email || null,
    });
  } catch (err) {
    console.error('updateNotificationSettings error', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getNotificationSettings,
  updateNotificationSettings,
};
