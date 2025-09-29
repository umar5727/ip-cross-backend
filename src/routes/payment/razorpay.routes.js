/**
 * Razorpay Payment Routes
 */

const express = require('express');
const router = express.Router();
const razorpayController = require('../../controllers/payment/razorpay.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// Create Razorpay order
router.post('/create-order', authMiddleware.isAuthenticated, razorpayController.createOrder);

// Verify payment
router.post('/verify-payment', authMiddleware.isAuthenticated, razorpayController.verifyPayment);

// Webhook handler (no auth required as it's called by Razorpay)
router.post('/webhook', razorpayController.webhook);

// Get payment details
router.get('/payment/:payment_id', authMiddleware.isAuthenticated, razorpayController.getPaymentDetails);

module.exports = router;