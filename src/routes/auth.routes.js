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

// OTP-based login routes
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.get('/otp-status/:telephone', authController.getOTPStatus);

module.exports = router;