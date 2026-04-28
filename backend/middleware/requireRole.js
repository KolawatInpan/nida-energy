function normalizeRoleName(user = {}) {
  const roleValue = user?.role ?? user?.userRole ?? user?.type ?? null;

  if (typeof roleValue === 'string') {
    return roleValue.toUpperCase();
  }

  if (roleValue && typeof roleValue === 'object') {
    if (roleValue.role_admin || roleValue.admin) return 'ADMIN';
    if (roleValue.role_consumer || roleValue.consumer) return 'USER';
    if (roleValue.role_user || roleValue.user) return 'USER';
    // legacy role flags that conceptually map to a normal user
    if (roleValue.role_producer || roleValue.producer) return 'USER';
    if (roleValue.role_battery || roleValue.battery) return 'USER';
  }

  return '';
}

function requireRole(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map((role) => String(role || '').toUpperCase()).filter(Boolean);

  return function roleMiddleware(req, res, next) {
    const userRole = normalizeRoleName(req.user);

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        requiredRoles: normalizedAllowedRoles,
        currentRole: userRole || null,
      });
    }

    next();
  };
}

module.exports = requireRole;
