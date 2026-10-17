// controllers/authController.js
// Handles user registration and login logic.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { recordAudit } = require('../utils/audit');
const { getJwtSecret } = require('../utils/authConfig');
require('dotenv').config();

const SALT_ROUNDS = 10;
const OWNER_EMAIL = 'faruqh042@gmail.com';

// ---------------------------------------------------------
// POST /api/register
// Creates a new user account (role is always "user" here;
// admins are created manually/directly in the database).
// ---------------------------------------------------------
async function register(req, res) {
  let connection;
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (typeof name !== 'string' || typeof email !== 'string' ||
        typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ message: 'Name, email and password are all required.' });
    }
    if (name.trim().length > 100 || email.trim().length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: 'Enter a valid name and email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    if (email.trim().toLowerCase() === OWNER_EMAIL) {
      return res.status(403).json({
        message: 'The owner account must be initialized securely by the server operator.'
      });
    }

    // Check if a user with this email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash the password before saving (never store plain text passwords!)
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashedPassword, 'user']
    );
    await recordAudit(connection, {
      actorId: result.insertId,
      action: 'user.registered',
      entityType: 'user',
      entityId: result.insertId
    });
    await connection.commit();

    return res.status(201).json({
      message: 'Registration successful! You can now log in.',
      userId: result.insertId
    });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Something went wrong during registration.' });
  } finally {
    if (connection) connection.release();
  }
}

// ---------------------------------------------------------
// POST /api/login
// Verifies email + password, returns a JWT token if correct.
// ---------------------------------------------------------
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password, role, is_active FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'This account is inactive. Please contact the site owner.' });
    }
    if (user.role === 'owner' && user.email.toLowerCase() !== OWNER_EMAIL) {
      return res.status(403).json({ message: 'Owner access is restricted to the configured account.' });
    }
    const secret = getJwtSecret();
    if (!secret) {
      return res.status(503).json({ message: 'Authentication is not configured securely.' });
    }

    // Create a JWT token containing basic (non-sensitive) user info
    const token = jwt.sign(
      { id: user.id, jti: require('crypto').randomUUID() },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role === 'owner' && user.email.toLowerCase() === OWNER_EMAIL ? 'owner' : user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Something went wrong during login.' });
  }
}

async function currentUser(req, res) {
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
}

module.exports = { register, login, currentUser };
