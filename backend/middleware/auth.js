const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) return res.status(401).json({ error: 'Authorization header missing' });
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization header format' });
  const token = parts[1];
  try {
    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret';
    const payload = jwt.verify(token, secret);
    // keep raw payload on req.auth, but expose a normalized req.user for controllers
    req.auth = payload;
    // token payload may be { user: { id, ... } } or may be the user directly
    req.user = payload.user ? payload.user : payload;
    next();
  } catch (err) {
    console.error('JWT verify error', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
