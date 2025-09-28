const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet/wallet.controller');
const { protect } = require('../middleware/auth.middleware');

// All wallet routes are protected
router.use(protect);

// Get wallet balance
router.get('/balance', walletController.getWalletBalance);

module.exports = router;
