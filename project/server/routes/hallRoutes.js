// routes/hallRoutes.js
// Public routes - anyone can view halls and check availability.
const express = require('express');
const router = express.Router();
const {
  getAllHalls,
  getHallById,
  getHallAvailability
} = require('../controllers/hallController');

router.get('/', getAllHalls);
router.get('/:id', getHallById);
router.get('/:id/availability', getHallAvailability);

module.exports = router;
