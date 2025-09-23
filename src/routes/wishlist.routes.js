const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/customer/wishlist.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication except popular products
router.use(protect);

// Wishlist CRUD operations
router.get('/', wishlistController.getWishlist);
router.get('/count', wishlistController.getWishlistCount);
router.get('/popular', wishlistController.getPopularWishlistProducts);
router.get('/date-range', wishlistController.getWishlistByDateRange);
router.get('/check/:productId', wishlistController.checkWishlistStatus);
router.post('/', wishlistController.addToWishlist);
router.post('/toggle', wishlistController.toggleWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
