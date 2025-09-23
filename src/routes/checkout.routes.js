/**
 * Checkout Routes
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');

// Define a simple handler function directly in this file
const processCheckout = (req, res) => {
  // Check payment method to provide appropriate response
  const paymentMethod = req.body.payment_method;
  
  if (paymentMethod && paymentMethod.code === 'cod') {
    // For COD payments, return success message
    res.status(200).json({
      success: true,
      order_success: true,
      message: 'Order placed successfully',
      data: req.body
    });
  } else {
    // For other payment methods (like online payments)
    res.status(200).json({
      success: true,
      order_success: false,
      message: 'Checkout process initiated',
      data: req.body
    });
  }
};

// Simple validation
const validateCheckout = [
  body('customer_id').isInt().withMessage('Valid customer ID is required'),
  body('cart_items').isArray().withMessage('Cart items are required')
];

// Define routes with direct function reference
router.post('/process', authMiddleware.protect, validateCheckout, processCheckout);

router.get('/order/:id', authMiddleware.protect, (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

module.exports = router;