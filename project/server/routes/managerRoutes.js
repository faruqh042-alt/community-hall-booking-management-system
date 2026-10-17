const express = require('express');
const router = express.Router();
const { verifyToken, isManager } = require('../middleware/auth');
const manager = require('../controllers/managerController');

router.use(verifyToken, isManager);

router.get('/dashboard', manager.getDashboard);
router.get('/bookings', manager.listBookings);
router.get('/calendar', manager.getCalendar);
router.put('/halls/:id', manager.updateHall);
router.put('/bookings/:id', manager.updateBookingStatus);

module.exports = router;
