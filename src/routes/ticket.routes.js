const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket/ticket.controller');
const { protect } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/tickets/categories
 * @desc    Get all available ticket categories
 * @access  Public
 */
router.get('/categories', ticketController.getTicketCategories);

// Apply authentication middleware to all other ticket routes
router.use(protect);

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Private (Customer)
 */
router.post('/', ticketController.createTicket);

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets for the authenticated customer
 * @query   status - Filter by status (open, pending, closed, all)
 * @query   ticket_id - Filter by specific ticket ID
 * @access  Private (Customer)
 */
router.get('/', ticketController.getCustomerTickets);

/**
 * @route   GET /api/tickets/:id
 * @desc    Get a specific ticket with replies
 * @access  Private (Customer)
 */
router.get('/:id', ticketController.getTicketById);

/**
 * @route   POST /api/tickets/:id/reply
 * @desc    Add a reply to a ticket
 * @access  Private (Customer)
 */
router.post('/:id/reply', ticketController.addReply);

module.exports = router;