// server.js
// This is the entry point of our backend. It sets up Express, connects
// middleware, wires up all the routes, and starts listening for requests.

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./db');

// Route files
const authRoutes = require('./routes/authRoutes');
const hallRoutes = require('./routes/hallRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(cors());              // allow the frontend (different port) to call this API
app.use(express.json());      // parse incoming JSON request bodies

// Serve the frontend static files (HTML/CSS/JS) from the /public folder.
// This means you can open http://localhost:5000/ and see index.html directly,
// without needing a separate frontend server.
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------- API ROUTES ----------------
app.use('/api', authRoutes);           // /api/register, /api/login
app.use('/api/halls', hallRoutes);     // /api/halls, /api/halls/:id, /api/halls/:id/availability
app.use('/api', bookingRoutes);        // /api/book, /api/bookings
app.use('/api/admin', adminRoutes);    // /api/admin/halls, /api/admin/bookings

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
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  await testConnection();
});
