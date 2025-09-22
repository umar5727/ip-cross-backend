const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart/cart.controller');
const { protect } = require('../middleware/auth.middleware');

// Get cart contents
router.get('/', cartController.getCart);

// Add product to cart
router.post('/add', protect, cartController.addToCart);

// Update cart item
router.put('/update', protect, cartController.updateCart);

// Remove item from cart
router.delete('/remove/:cart_id', protect, cartController.removeFromCart);

// Clear cart
router.delete('/clear', protect, cartController.clearCart);

module.exports = router;