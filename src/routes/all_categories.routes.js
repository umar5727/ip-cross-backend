const express = require('express');
const router = express.Router();
const allCategoriesController = require('../controllers/category/all_categories.controller');
const cache = require('../middleware/cache');

// Route to get all categories with optional group_ids parameter
router.get('/', cache(300), allCategoriesController.getAllCategories);

module.exports = router;