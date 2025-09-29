/**
 * Razorpay Payment Routes with Enhanced Security
 */

const express = require('express');
const router = express.Router();
const razorpayController = require('../../controllers/payment/razorpay.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const securityMiddleware = require('../../middleware/security.middleware');

// Apply security headers to all routes
router.use(securityMiddleware.securityHeaders);
router.use(securityMiddleware.requestLogger);

// Create Razorpay order with rate limiting
router.post('/create-order', 
  securityMiddleware.paymentRateLimit,
  securityMiddleware.validatePaymentRequest,
  authMiddleware.protect,
  razorpayController.createOrder
);

// Verify payment with rate limiting
router.post('/verify-payment',
  securityMiddleware.paymentRateLimit,
  securityMiddleware.validatePaymentRequest,
  authMiddleware.protect,
  razorpayController.verifyPayment
);

// Webhook handler with IP whitelisting and signature validation
router.post('/webhook',
  securityMiddleware.webhookIPWhitelist,
  securityMiddleware.validateWebhookSignature,
  razorpayController.handleWebhook
);

// Create refund
router.post('/refund',
  securityMiddleware.paymentRateLimit,
  authMiddleware.protect,
  razorpayController.createRefund
);

// Error handling middleware
router.use(securityMiddleware.errorHandler);

module.exports = router;