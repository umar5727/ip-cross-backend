const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart/cart.controller');
const { protect } = require('../middleware/auth.middleware');
const { optionalAuth } = require('../middleware/guest-cart.middleware');

// Apply optional authentication middleware to all cart routes
router.use(optionalAuth);

// Get cart contents - works for both guest and logged-in users
router.get('/', cartController.getCart);

// Add product to cart - works for both guest and logged-in users
router.post('/add', cartController.addToCart);

// Update cart item - works for both guest and logged-in users
router.put('/update', cartController.updateCart);

// Remove item from cart - works for both guest and logged-in users
router.delete('/remove', cartController.removeFromCart);

// Clear cart - works for both guest and logged-in users
router.delete('/clear', cartController.clearCart);

// Transfer guest cart to user account after login - requires authentication
router.post('/transfer', protect, cartController.transferGuestCart);

module.exports = router;