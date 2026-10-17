// server.js
// This is the entry point of our backend. It sets up Express, connects
// middleware, wires up all the routes, and starts listening for requests.

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./db');
const { migrate } = require('./scripts/migrate');

// Route files
const authRoutes = require('./routes/authRoutes');
const hallRoutes = require('./routes/hallRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const managerRoutes = require('./routes/managerRoutes');

const app = express();

// ---------------- MIDDLEWARE ----------------
const configuredOrigins = [process.env.APP_ORIGIN, process.env.CORS_ALLOWED_ORIGINS]
  .filter(Boolean)
  .join(',');
const allowedOrigins = [
  ...configuredOrigins.split(',').map(origin => origin.trim()).filter(Boolean),
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());      // parse incoming JSON request bodies
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});

// Serve the frontend static files (HTML/CSS/JS) from the /public folder.
// This means you can open http://localhost:5000/ and see index.html directly,
// without needing a separate frontend server.
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------- API ROUTES ----------------
app.use('/api', authRoutes);           // /api/register, /api/login
app.use('/api/halls', hallRoutes);     // /api/halls, /api/halls/:id, /api/halls/:id/availability
app.use('/api', bookingRoutes);        // /api/book, /api/bookings
app.use('/api/admin', adminRoutes);    // /api/admin/halls, /api/admin/bookings
app.use('/api/owner', ownerRoutes);
app.use('/api/manager', managerRoutes);

// Simple health-check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running.' });
});

// ---------------- ERROR HANDLING ----------------
// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

// Generic error handler (catches anything thrown/passed to next(err))
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  try {
    await migrate();
    console.log('✅ Database schema checked and updated if needed.');
  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
  }

  console.log(`🚀 Server running at http://localhost:${PORT}`);
  await testConnection();
});
