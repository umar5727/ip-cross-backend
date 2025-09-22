const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category/category.controller');
const { protect } = require('../middleware/auth.middleware');

// Get all categories - public route with caching
router.get('/', categoryController.getAllCategories);

// Get category by ID with products - public route with caching
router.get('/:id', categoryController.getCategoryById);

// Create category - protected route
router.post('/', protect, categoryController.createCategory);

// Update category - protected route
router.put('/:id', protect, categoryController.updateCategory);

// Delete category - protected route
router.delete('/:id', protect, categoryController.deleteCategory);

module.exports = router;