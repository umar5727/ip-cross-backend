const express = require('express');
const router = express.Router();
const orderHistoryController = require('../controllers/customer/order-history.controller');
const { protect } = require('../middleware/auth.middleware');

// Route to add order history and update order status
router.post('/add', protect, orderHistoryController.addOrderHistory);

module.exports = router;