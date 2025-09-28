const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner/banner.controller');

// Public routes - no authentication required

// Get all banners (grouped by device)
router.get('/', bannerController.getAllBanners);

// Device-specific routes (must come before /:bannerId)
router.get('/android', bannerController.getAndroidBanners);
router.get('/ios', bannerController.getIOSBanners);
router.get('/tablet', bannerController.getTabletBanners);

// Get banners by specific device
router.get('/device/:device', bannerController.getBannersByDevice);

// Get single banner by ID (must come last)
router.get('/:bannerId', bannerController.getBannerById);

module.exports = router;
