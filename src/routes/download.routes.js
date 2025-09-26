const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download/download.controller');

// Get customer downloads
router.get('/', downloadController.getDownloads);

// Download a file
router.get('/:downloadId', downloadController.downloadFile);

module.exports = router;