const { Ticket, TicketReply, Customer } = require('../../models');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../ticket_uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

/**
 * Get all tickets (admin view)
 * @route GET /api/admin/tickets
 */
const getAllTickets = async (req, res) => {
  try {
    const { status = 'all', customer_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause based on filters
    const whereConditions = {};
    
    if (status !== 'all') {
      whereConditions.status = status;
    }
    
    if (customer_id) {
      whereConditions.customer_id = customer_id;
    }

    // Get tickets with customer information
    const tickets = await Ticket.findAll({
      where: whereConditions,
      include: [{
        model: Customer,
        attributes: ['firstname', 'lastname', 'email']
      }],
      order: [['date_added', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get total count for pagination
    const total = await Ticket.count({ where: whereConditions });

    // Get status counts
    const statusCounts = await Ticket.findAll({
      attributes: [
        'status',
        [Ticket.sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['status'],
      raw: true
    });
    
    const statusSummary = {
      total: total,
      open: 0,
      pending: 0,
      closed: 0
    };
    
    statusCounts.forEach(item => {
      statusSummary[item.status] = parseInt(item.count);
    });

    res.json({
      success: true,
      data: {
        tickets: tickets,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: Math.ceil(total / limit)
        },
        status_counts: statusSummary,
        filters: {
          status: status,
          customer_id: customer_id
        }
      }
    });
  } catch (error) {
    console.error('Error getting all tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets',
      error: error.message
    });
  }
};

/**
 * Get a specific ticket by ID (admin view)
 * @route GET /api/admin/tickets/:id
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get ticket details with customer information and replies
    const ticket = await Ticket.findOne({
      where: { ticket_id: id },
      include: [
        {
          model: Customer,
          attributes: ['firstname', 'lastname', 'email']
        },
        {
          model: TicketReply,
          order: [['date_added', 'ASC']]
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error getting ticket by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket',
      error: error.message
    });
  }
};

/**
 * Add an admin reply to a ticket
 * @route POST /api/admin/tickets/:id/reply
 */
const addAdminReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.customer.customer_id; // Using customer_id as admin ID for now

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }

    // Check if ticket exists
    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Handle file attachment if present
    let attachment = null;
    if (req.file) {
      attachment = req.file.filename;
    }

    // Create admin reply
    const reply = await TicketReply.create({
      ticket_id: id,
      message: message.trim(),
      user_type: 'admin',
      customer_id: adminId,
      file: attachment,
      date_added: new Date()
    });

    // Update ticket status to 'pending' when admin replies
    await ticket.update({ status: 'pending' });

    res.json({
      success: true,
      message: 'Admin reply added successfully',
      data: {
        reply_id: reply.reply_id,
        ticket_id: id,
        message: message.trim(),
        user_type: 'admin',
        user_id: adminId,
        attachment: attachment,
        created_at: reply.date_added
      }
    });
  } catch (error) {
    console.error('Error adding admin reply:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reply',
      error: error.message
    });
  }
};

/**
 * Update ticket status
 * @route PUT /api/admin/tickets/:id/status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['open', 'pending', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Check if ticket exists
    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const oldStatus = ticket.status;

    // Update ticket status
    await ticket.update({ status: status });

    res.json({
      success: true,
      message: 'Ticket status updated successfully',
      data: {
        ticket_id: id,
        old_status: oldStatus,
        new_status: status,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: error.message
    });
  }
};

/**
 * Update ticket details
 * @route PUT /api/admin/tickets/:id
 */
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, category_id, priority, status } = req.body;

    // Check if ticket exists
    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Build update object
    const updateFields = {};

    if (subject) {
      updateFields.subject = subject;
    }
    if (category_id) {
      updateFields.category_id = category_id;
    }
    if (priority) {
      updateFields.priority = priority;
    }
    if (status) {
      const validStatuses = ['open', 'pending', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }
      updateFields.status = status;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Update ticket
    await ticket.update(updateFields);

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: {
        ticket_id: id,
        updated_fields: { subject, category_id, priority, status },
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  addAdminReply: [upload.single('attachment'), addAdminReply],
  updateTicketStatus,
  updateTicket
};