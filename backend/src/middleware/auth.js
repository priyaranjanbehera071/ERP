const jwt = require('jsonwebtoken');
const { HttpError } = require('../util');

function authenticate(req, _res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = jwt.verify(m[1], process.env.JWT_SECRET);
    next();
  } catch { next(new HttpError(401, 'Invalid or expired token')); }
}
const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have permission for this action'));

module.exports = { authenticate, authorize };
