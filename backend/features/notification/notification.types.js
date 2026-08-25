/**
 * Notification type registry — single source of truth for notification types.
 * Used by: notification.service (dispatch), and every sender (invoice, market,
 * meter monitor, wallet, etc.) so all go through the same preference gate.
 *
 * The `notifyTypes` array on a User stores the keys the user has DISABLED? NO —
 * it stores the keys the user has ENABLED. An empty array means "all enabled"
 * (backwards compatible with the pre-notifyTypes behavior).
 */

const NOTIFICATION_TYPES = {
  // System / account events
  SYSTEM: 'system',             // user_registered, meter_added, building_added, approvals
  // Wallet / topup
  WALLET: 'wallet',             // topup, addBalance, payments
  // Billing / invoice
  INVOICE: 'invoice',           // invoice overdue, payment reminders, receipts
  // Market / trading
  MARKET: 'market',             // offer/bid created, trade matched, market events
  // Meter health
  METER_ALERT: 'meter_alert',   // meter inactive, meter down, connectivity
};

/** Sentinel value stored in notifyTypes to mean "all disabled". */
const NOTIFY_NONE = 'none';

/** Human-friendly labels (English) shown in Settings UI */
const NOTIFICATION_TYPE_LABELS = {
  [NOTIFICATION_TYPES.SYSTEM]: 'System',
  [NOTIFICATION_TYPES.WALLET]: 'Wallet & Topup',
  [NOTIFICATION_TYPES.INVOICE]: 'Invoice & Billing',
  [NOTIFICATION_TYPES.MARKET]: 'Market & Trading',
  [NOTIFICATION_TYPES.METER_ALERT]: 'Meter Alerts',
};

/**
 * Map a raw event `type` (as passed to createNotification/senders) to its
 * NOTIFICATION_TYPES category key. Unknown types default to SYSTEM.
 */
function categorizeType(rawType) {
  const t = String(rawType || '').toLowerCase();
  if (t.includes('invoice') || t.includes('payment') || t.includes('receipt') || t.includes('bill')) return NOTIFICATION_TYPES.INVOICE;
  if (t.includes('topup') || t.includes('wallet') || t.includes('balance') || t.includes('credit')) return NOTIFICATION_TYPES.WALLET;
  if (t.includes('offer') || t.includes('bid') || t.includes('market') || t.includes('trade') || t.includes('match') || t.includes('sell') || t.includes('purchase')) return NOTIFICATION_TYPES.MARKET;
  if (t.includes('inactive') || t.includes('meter') || t.includes('down') || t.includes('alert')) return NOTIFICATION_TYPES.METER_ALERT;
  return NOTIFICATION_TYPES.SYSTEM;
}

/**
 * Whether a user has a given notification category enabled.
 * @param {object} user - Prisma User row (or { notifyTypes })
 * @param {string} type - raw event type string (categorized internally)
 */
function isNotificationEnabled(user, type) {
  if (!user) return true; // no user context → always allow (admin/global senders)
  const enabled = Array.isArray(user.notifyTypes) ? user.notifyTypes : [];
  // "all disabled" sentinel → nothing is enabled
  if (enabled.includes(NOTIFY_NONE)) return false;
  // Empty array = all enabled (default / backwards compatible)
  if (enabled.length === 0) return true;
  const category = categorizeType(type);
  return enabled.includes(category);
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFY_NONE,
  categorizeType,
  isNotificationEnabled,
};
