const express = require('express');
const router = express.Router();
const productController = require('../controllers/product/product.controller');
const { protect } = require('../middleware/auth.middleware');

// Get all products - public route with caching
router.get('/', productController.getAllProducts);

// Get product by ID - public route with caching
router.get('/:id', productController.getProductById);

// Create product - protected route
router.post('/', protect, productController.createProduct);

// Update product - protected route
router.put('/:id', protect, productController.updateProduct);

// Delete product - protected route
router.delete('/:id', protect, productController.deleteProduct);

module.exports = router;