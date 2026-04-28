// Simple role-permission map and helpers
// Roles: USER, ADMIN

const PERMISSIONS = {
  USER: new Set([
    // Profile
    'profile:read',
    'profile:update',
    // Meters & energy
    'meters:read',
    'meters:register',
    'meters:update_own',
    // Trading
    'offers:create',
    'offers:read',
    'offers:purchase',
    // Billing
    'invoices:read',
    'receipts:read',
    // Wallet
    'wallet:topup',
    'wallet:read',
  ]),

  ADMIN: new Set(['*']), // wildcard: all actions
};

function normalizeRoleName(user = {}) {
  const roleValue = user?.role ?? user?.userRole ?? user?.type ?? null;

  if (typeof roleValue === 'string') return String(roleValue || '').toUpperCase();

  if (roleValue && typeof roleValue === 'object') {
    if (roleValue.role_admin || roleValue.admin) return 'ADMIN';
    if (roleValue.role_consumer || roleValue.consumer) return 'USER';
    if (roleValue.role_user || roleValue.user) return 'USER';
    if (roleValue.role_producer || roleValue.producer) return 'USER';
    if (roleValue.role_battery || roleValue.battery) return 'USER';
  }

  return '';
}

function hasPermission(user, action) {
  if (!action) return false;
  const role = normalizeRoleName(user) || 'USER';
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  if (perms.has('*')) return true;
  return perms.has(action);
}

module.exports = {
  PERMISSIONS,
  hasPermission,
  normalizeRoleName,
};
