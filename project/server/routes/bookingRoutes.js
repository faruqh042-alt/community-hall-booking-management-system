// routes/bookingRoutes.js
// These routes require the user to be logged in (verifyToken middleware).
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { createBooking, getMyBookings } = require('../controllers/bookingController');

router.post('/book', verifyToken, createBooking);
router.get('/bookings', verifyToken, getMyBookings);

module.exports = router;
