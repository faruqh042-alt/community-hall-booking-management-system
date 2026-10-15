// middleware/auth.js
// These functions "guard" our routes. They run BEFORE the route's main
// controller function, and check whether the request is allowed to continue.

const jwt = require('jsonwebtoken');
require('dotenv').config();

// verifyToken: checks that the request has a valid JWT token.
// The frontend sends the token in the "Authorization" header like:
//   Authorization: Bearer <token>
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1]; // "Bearer TOKEN" -> TOKEN

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info { id, name, email, role } to the request
    next(); // continue to the actual route
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
}

// isAdmin: must be used AFTER verifyToken. Checks the logged-in user's role.
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
}

module.exports = { verifyToken, isAdmin };
