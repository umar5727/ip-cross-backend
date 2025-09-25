const express = require('express');
const router = express.Router();

// Import ClickPost controllers
const deliveryController = require('../controllers/clickpost/delivery.controller');
const trackingController = require('../controllers/clickpost/tracking.controller');
const cancelController = require('../controllers/clickpost/cancel.controller');

// Import middleware
const { protect } = require('../middleware/auth.middleware');

// PUBLIC ROUTES (No authentication required)
// Public delivery estimation for product pages
router.post('/estimate/public', deliveryController.getPublicDeliveryEstimate);

// Apply authentication middleware to all routes below
router.use(protect);

// Delivery Estimation Routes (Authenticated)
router.post('/estimate', deliveryController.estimateDelivery);
router.post('/estimate/pincode', deliveryController.estimateDeliveryByPincode);

// Order Tracking Routes
router.get('/track/awb/:awb', trackingController.trackOrder);
router.get('/track/order/:orderId', trackingController.trackOrderById);
router.get('/track/history/:orderId', trackingController.getTrackingHistory);

// Order Cancellation Routes
router.post('/cancel', cancelController.cancelOrder);
router.get('/cancel/eligibility/:orderId', cancelController.checkCancellationEligibility);
// router.get('/cancel/status/:orderId', cancelController.getCancellationStatus);

module.exports = router;
