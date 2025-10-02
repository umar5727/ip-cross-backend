/**
 * Razorpay Payment Routes
 * Handles Razorpay payment endpoints for split orders
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');
const {
  createRazorpayOrder,
  verifyPayment,
  getPaymentStatus,
  processRefund,
  handleWebhook
} = require('../controllers/payment/razorpay.controller');

// Validation middleware for creating Razorpay order
const validateCreateOrder = [
  body('parent_order_id')
    .notEmpty()
    .withMessage('Parent order ID is required'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a valid number')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least 1'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters'),
  body('notes')
    .optional()
    .isObject()
    .withMessage('Notes must be an object')
];

// Validation middleware for verifying payment
const validateVerifyPayment = [
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Razorpay order ID is required'),
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Razorpay payment ID is required'),
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Razorpay signature is required'),
  body('parent_order_id')
    .notEmpty()
    .withMessage('Parent order ID is required')
];

// Validation middleware for processing refund
const validateProcessRefund = [
  body('parent_order_id')
    .notEmpty()
    .withMessage('Parent order ID is required'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a valid number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be at least 0.01'),
  body('notes')
    .optional()
    .isObject()
    .withMessage('Notes must be an object')
];

// Validation middleware for webhook
const validateWebhook = [
  body('event')
    .notEmpty()
    .withMessage('Event type is required'),
  body('payload')
    .notEmpty()
    .withMessage('Payload is required')
];

// Routes

/**
 * @route   POST /api/razorpay/create-order
 * @desc    Create Razorpay order for parent order
 * @access  Private
 */
router.post('/create-order', authMiddleware.protect, validateCreateOrder, createRazorpayOrder);

/**
 * @route   POST /api/razorpay/verify
 * @desc    Verify payment signature
 * @access  Private
 */
router.post('/verify', authMiddleware.protect, validateVerifyPayment, verifyPayment);

/**
 * @route   GET /api/razorpay/status/:parent_order_id
 * @desc    Get payment status by parent order ID
 * @access  Private
 */
router.get('/status/:parent_order_id', authMiddleware.protect, getPaymentStatus);

/**
 * @route   POST /api/razorpay/refund
 * @desc    Process refund for parent order
 * @access  Private
 */
router.post('/refund', authMiddleware.protect, validateProcessRefund, processRefund);

/**
 * @route   POST /api/razorpay/webhook
 * @desc    Handle Razorpay webhooks
 * @access  Public (no auth required for webhooks)
 */
router.post('/webhook', validateWebhook, handleWebhook);

module.exports = router;
