const express = require('express');
const router = express.Router();
const homeContentController = require('../controllers/home/home_content.controller');

// Get initial home content
router.get('/', homeContentController.getHomeContent);

// Load more content (mobile-specific)
router.get('/load-more', homeContentController.loadMore);

// Load more content (desktop-specific)
router.get('/load-more-d', homeContentController.loadMoreD);

module.exports = router;