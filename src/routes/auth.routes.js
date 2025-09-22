const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Register a new customer
router.post('/register', authController.register);

// Login customer
router.post('/login', authController.login);

// Logout customer
router.post('/logout', protect, authController.logout);

// Get current customer profile
router.get('/profile', protect, authController.getProfile);

module.exports = router;