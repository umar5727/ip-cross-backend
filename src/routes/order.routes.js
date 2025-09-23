const express = require('express');
const router = express.Router();
const orderController = require('../controllers/customer/order.controller');
const { protect } = require('../middleware/auth.middleware');

// All order routes are protected
router.use(protect);

// Get all orders for authenticated customer
router.get('/', orderController.getAllOrders);

// Get order statuses (must be before /:id route)
router.get('/statuses/list', orderController.getOrderStatuses);

// Track order by AWB number (must be before /:id route)
router.get('/track/:awbno', orderController.trackOrder);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Create new order
router.post('/', orderController.createOrder);

// Update order status
router.put('/:id/status', orderController.updateOrderStatus);

// Cancel order
router.put('/:id/cancel', orderController.cancelOrder);

// Get order history
router.get('/:id/history', orderController.getOrderHistory);

module.exports = router;