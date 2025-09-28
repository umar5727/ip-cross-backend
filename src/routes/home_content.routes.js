const express = require('express');
const router = express.Router();
const homeContentController = require('../controllers/home/home_content.controller');

// Get initial home content
router.get('/', homeContentController.getHomeContent);

// Load more content (mobile-specific)
router.get('/load-more', homeContentController.loadMore);

module.exports = router;