// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, currentUser } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, currentUser);

module.exports = router;
