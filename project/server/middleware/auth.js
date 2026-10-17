const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { getJwtSecret } = require('../utils/authConfig');

const OWNER_EMAIL = 'faruqh042@gmail.com';
const ALLOWED_ROLES = new Set(['user', 'admin', 'manager', 'owner']);

async function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  const secret = getJwtSecret();
  if (!secret) {
    return res.status(503).json({ message: 'Authentication is not configured securely.' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (!Number.isSafeInteger(Number(decoded.id))) {
      return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'This account is inactive. Please contact the site owner.' });
    }
    if (!ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({ message: 'This account does not have an authorized role.' });
    }

    req.user = {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role
    };
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
    }
    console.error('Token verification error:', err);
    return res.status(500).json({ message: 'Could not verify the current session.' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Please log in to continue.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    if (req.user.role === 'owner' && req.user.email.toLowerCase() !== OWNER_EMAIL) {
      return res.status(403).json({ message: 'Owner access is restricted to the configured account.' });
    }
    return next();
  };
}

const isAdmin = allowRoles('admin');
const isOwner = allowRoles('owner');
const isManager = allowRoles('manager');

module.exports = { OWNER_EMAIL, verifyToken, allowRoles, isAdmin, isOwner, isManager };
