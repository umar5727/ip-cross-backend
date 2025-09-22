const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/razorpay/razorpay.controller');
const { protect: authMiddleware } = require('../middleware/auth.middleware');
const { razorpayWebhookMiddleware } = require('../middleware/razorpayWebhook.middleware');

// Payment routes (protected with auth middleware)
router.post('/create-order', authMiddleware, razorpayController.createOrder);
router.post('/verify-payment', authMiddleware, razorpayController.verifyPayment);
router.post('/refund', authMiddleware, razorpayController.createRefund);
router.post('/create-invoice', authMiddleware, razorpayController.createInvoice);
router.get('/payment-status/:order_id', authMiddleware, razorpayController.getPaymentStatus);

// Webhook route (no auth middleware, but has signature verification)
router.post('/webhook', razorpayWebhookMiddleware, razorpayController.handleWebhook);

module.exports = router;