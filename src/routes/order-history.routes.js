const express = require('express');
const router = express.Router();
const orderHistoryController = require('../controllers/order/order-history.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Route to add order history and update order status
router.post('/add', authMiddleware, orderHistoryController.addOrderHistory);

module.exports = router;