const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer/customer.controller');
const { protect } = require('../middleware/auth.middleware');

// Get all customers - protected route
router.get('/', protect, customerController.getAllCustomers);

// Get customer by ID - protected route
router.get('/:id', protect, customerController.getCustomerById);

// Update customer - protected route
router.put('/:id', protect, customerController.updateCustomer);

// Delete customer - protected route
router.delete('/:id', protect, customerController.deleteCustomer);

module.exports = router;