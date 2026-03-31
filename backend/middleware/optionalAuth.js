const jwt = require('jsonwebtoken');

// optional auth: if Authorization header present, verify token and set req.auth/req.user
// otherwise continue without failing.
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) return next();
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return next();
  const token = parts[1];
  try {
    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret';
    const payload = jwt.verify(token, secret);
    req.auth = payload;
    req.user = payload.user ? payload.user : payload;
  } catch (err) {
    // ignore verification errors for optional auth
    console.warn('optionalAuth: token verify failed', err.message || err);
  }
  return next();
}

module.exports = optionalAuth;

