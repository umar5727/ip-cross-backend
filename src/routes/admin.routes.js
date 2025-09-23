const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/admin.controller');
const { protect } = require('../middleware/auth.middleware');

// Apply authentication middleware to all admin routes
// Note: In a real application, you'd have admin-specific authentication
router.use(protect);

/**
 * @route   GET /api/admin/tickets
 * @desc    Get all tickets (admin view)
 * @query   status - Filter by status (open, pending, closed, all)
 * @query   customer_id - Filter by customer ID
 * @access  Private (Admin)
 */
router.get('/tickets', adminController.getAllTickets);

/**
 * @route   GET /api/admin/tickets/:id
 * @desc    Get a specific ticket with replies (admin view)
 * @access  Private (Admin)
 */
router.get('/tickets/:id', adminController.getTicketById);

/**
 * @route   POST /api/admin/tickets/:id/reply
 * @desc    Add an admin reply to a ticket
 * @access  Private (Admin)
 */
router.post('/tickets/:id/reply', adminController.addAdminReply);

/**
 * @route   PUT /api/admin/tickets/:id/status
 * @desc    Update ticket status
 * @access  Private (Admin)
 */
router.put('/tickets/:id/status', adminController.updateTicketStatus);

/**
 * @route   PUT /api/admin/tickets/:id
 * @desc    Update ticket details
 * @access  Private (Admin)
 */
router.put('/tickets/:id', adminController.updateTicket);

module.exports = router;