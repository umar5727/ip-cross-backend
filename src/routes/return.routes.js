const express = require('express');
const router = express.Router();
const returnController = require('../controllers/return/return.controller');
const { protect } = require('../middleware/auth.middleware');

// All return routes are protected
router.use(protect);

// Create new return request
router.post('/', returnController.createReturn);

// Get all returns for authenticated customer
router.get('/', returnController.getCustomerReturns);

// Get return statuses (must be before /:id route)
router.get('/statuses', returnController.getReturnStatuses);

// Get return reasons (must be before /:id route)
router.get('/reasons', returnController.getReturnReasons);

// Get return by ID
router.get('/:id', returnController.getReturnById);

module.exports = router;
