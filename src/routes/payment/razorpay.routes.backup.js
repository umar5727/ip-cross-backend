/**
 * Razorpay Payment Routes
 */

const express = require('express');
const router = express.Router();
const razorpayController = require('../../controllers/payment/razorpay.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// Create Razorpay order
router.post('/create-order', authMiddleware.isAuthenticated, function(req, res) {
  razorpayController.createOrder(req, res);
});

// Verify payment
router.post('/verify-payment', authMiddleware.isAuthenticated, function(req, res) {
  razorpayController.verifyPayment(req, res);
});

// Webhook handler (no auth required as it's called by Razorpay)
router.post('/webhook', function(req, res) {
  razorpayController.webhook(req, res);
});

// Get payment details
router.get('/payment/:payment_id', authMiddleware.isAuthenticated, function(req, res) {
  razorpayController.getPaymentDetails(req, res);
});

// Get all payments for a user
router.get('/user-payments', authMiddleware.isAuthenticated, function(req, res) {
  razorpayController.getUserPayments(req, res);
});

module.exports = router;