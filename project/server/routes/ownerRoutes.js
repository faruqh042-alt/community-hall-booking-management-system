const express = require('express');
const router = express.Router();
const { verifyToken, isOwner } = require('../middleware/auth');
const { addHall, updateHall, deleteHall } = require('../controllers/hallController');
const { updateBookingStatus } = require('../controllers/bookingController');
const owner = require('../controllers/ownerController');

router.use(verifyToken, isOwner);

router.get('/dashboard', owner.getDashboard);
router.get('/users', owner.listUsers);
router.put('/users/:id/role', owner.updateUserRole);
router.patch('/users/:id/active', owner.setUserActive);
router.get('/managers/:id/halls', owner.listManagerHalls);
router.put('/managers/:id/halls', owner.setManagerHalls);
router.get('/halls', owner.listHalls);
router.post('/halls', addHall);
router.put('/halls/:id', updateHall);
router.patch('/halls/:id/active', owner.setHallActive);
router.delete('/halls/:id', deleteHall);
router.get('/bookings', owner.listBookings);
router.put('/bookings/:id', updateBookingStatus);

module.exports = router;
