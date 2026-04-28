const { hasPermission } = require('../utils/roles');

function requirePermission(action) {
  if (!action) throw new Error('requirePermission requires an action string');

  return function permissionMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    try {
      if (!hasPermission(req.user, action)) {
        return res.status(403).json({ error: 'Forbidden', required: action });
      }
    } catch (err) {
      return res.status(500).json({ error: 'permission-check-failed' });
    }

    return next();
  };
}

module.exports = requirePermission;
