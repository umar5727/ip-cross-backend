const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download/download.controller');
const { protect } = require('../middleware/auth.middleware');

// Get customer downloads - requires authentication
router.get('/', protect, downloadController.getDownloads);

// Download a file - requires authentication
router.get('/:downloadId', protect, downloadController.downloadFile);

module.exports = router;