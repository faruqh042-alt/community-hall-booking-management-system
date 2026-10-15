// routes/adminRoutes.js
// Every route here requires the user to be logged in AND have role = 'admin'.
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');

const { addHall, updateHall, deleteHall } = require('../controllers/hallController');
const { getAllBookings, updateBookingStatus } = require('../controllers/bookingController');

// All admin routes use both middlewares, in order: verifyToken -> isAdmin
router.use(verifyToken, isAdmin);

// Hall management
router.post('/halls', addHall);
router.put('/halls/:id', updateHall);
router.delete('/halls/:id', deleteHall);

// Booking management
router.get('/bookings', getAllBookings);
router.put('/bookings/:id', updateBookingStatus);

module.exports = router;
