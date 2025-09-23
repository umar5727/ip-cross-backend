const { Ticket, TicketReply, Customer } = require('../../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads/tickets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '_' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Category mapping (same as PHP)
const TICKET_CATEGORIES = {
  1: 'Order Issues',
  2: 'Payment and Billing Issues',
  3: 'Shipping and Delivery',
  4: 'Product or Service Inquiries',
  5: 'Returns and Exchanges',
  6: 'Others'
};

// Get ticket categories
exports.getTicketCategories = (req, res) => {
  try {
    const categories = Object.entries(TICKET_CATEGORIES).map(([id, name]) => ({
      category_id: id,
      name
    }));

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get ticket categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve categories'
    });
  }
};

// Create new ticket
exports.createTicket = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { subject, category_id, priority, message } = req.body;
      const customer_id = req.customer?.customer_id || 8779; // Default to test customer if not available

      // Validation
      if (!subject || !category_id || !message) {
        return res.status(400).json({
          success: false,
          message: 'All fields (subject, category_id, message) are required'
        });
      }

      if (!TICKET_CATEGORIES[category_id]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category selected'
        });
      }

      const ticketData = {
        customer_id,
        subject,
        category: TICKET_CATEGORIES[category_id],
        description: message,
        message: message,
        status: 'open',
        file: '',
        date_added: new Date()
      };

      // Add file if uploaded
      if (req.file) {
        ticketData.file = req.file.filename;
      }

      const ticket = await Ticket.create(ticketData);

      res.status(201).json({
        success: true,
        message: 'Your ticket has been submitted successfully',
        data: {
          ticket_id: ticket.ticket_id,
          subject: ticket.subject,
          category: TICKET_CATEGORIES[ticket.category],
          status: ticket.status,
          date_added: ticket.date_added
        }
      });

    } catch (error) {
      console.error('Create ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not create ticket'
      });
    }
  }
];

// Get all tickets for a customer
exports.getCustomerTickets = async (req, res) => {
  try {
    const customer_id = req.customer?.customer_id || 8779; // Default to test customer if not available
    const { status = 'all', ticket_id } = req.query;

    let whereClause = { customer_id };

    // Filter by status if not 'all'
    if (status !== 'all') {
      whereClause.status = status;
    }

    // Filter by ticket ID if provided
    if (ticket_id) {
      whereClause.ticket_id = ticket_id;
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      order: [['date_added', 'DESC']],
      include: [
        {
          model: Customer,
          attributes: ['firstname', 'lastname', 'email'],
          required: false
        }
      ]
    });

    // Get ticket counts for all statuses (unfiltered)
    const allTickets = await Ticket.findAll({
      where: { customer_id },
      attributes: ['status']
    });

    const counts = {
      total: allTickets.length,
      open: allTickets.filter(t => t.status === 'open').length,
      pending: allTickets.filter(t => t.status === 'pending').length,
      closed: allTickets.filter(t => t.status === 'closed').length
    };

    // Format tickets with category names
    const formattedTickets = tickets.map(ticket => ({
      ticket_id: ticket.ticket_id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      file: ticket.file,
      date_added: ticket.date_added,
      date_modified: ticket.date_modified
    }));

    res.status(200).json({
      success: true,
      data: formattedTickets,
      counts,
      filters: {
        status,
        ticket_id: ticket_id || ''
      }
    });

  } catch (error) {
    console.error('Get customer tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve tickets'
    });
  }
};

// Get single ticket with replies
exports.getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer_id = req.customer?.customer_id || 8779; // Default to test customer if not available

    const ticket = await Ticket.findOne({
      where: { 
        ticket_id: id,
        customer_id 
      },
      include: [
        {
          model: Customer,
          attributes: ['firstname', 'lastname', 'email'],
          required: false
        },
        {
          model: TicketReply,
          order: [['date_added', 'ASC']],
          required: false
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Format ticket data
    const formattedTicket = {
      ticket_id: ticket.ticket_id,
      subject: ticket.subject,
      description: ticket.description,
      category: TICKET_CATEGORIES[ticket.category] || 'Unknown',
      status: ticket.status,
      priority: ticket.priority,
      file: ticket.file,
      date_added: ticket.date_added,
      date_modified: ticket.date_modified,
      customer: ticket.Customer,
      replies: (ticket.TicketReplies || []).map(reply => ({
        reply_id: reply.reply_id,
        message: reply.message,
        file: reply.file,
        sender_type: reply.sender_type,
        sender_id: reply.sender_id,
        is_customer: reply.sender_type === 'customer',
        date_added: reply.date_added
      }))
    };

    res.status(200).json({
      success: true,
      data: formattedTicket
    });

  } catch (error) {
    console.error('Get ticket by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve ticket'
    });
  }
};

// Add reply to ticket
exports.addReply = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const customer_id = req.customer?.customer_id || 8779; // Default to test customer if not available

      if (!message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reply message is required'
        });
      }

      // Verify ticket belongs to customer
      const ticket = await Ticket.findOne({
        where: { 
          ticket_id: id,
          customer_id 
        }
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      const replyData = {
        ticket_id: id,
        message: message.trim(),
        user_type: 'customer',
        customer_id: customer_id,
        date_added: new Date()
      };

      // Add file if uploaded
      if (req.file) {
        replyData.file = req.file.filename;
      }

      const reply = await TicketReply.create(replyData);

      // Update ticket's date_modified and status
      await ticket.update({ 
        date_modified: new Date(),
        status: 'customer-reply'
      });

      res.status(201).json({
        success: true,
        message: 'Reply added successfully',
        data: {
          reply_id: reply.reply_id,
          message: reply.message,
          file: reply.file,
          date_added: reply.date_added
        }
      });

    } catch (error) {
      console.error('Add reply error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not add reply'
      });
    }
  }
];

module.exports = {
  createTicket: exports.createTicket,
  getCustomerTickets: exports.getCustomerTickets,
  getTicketById: exports.getTicketById,
  addReply: exports.addReply,
  getTicketCategories: exports.getTicketCategories,
  upload
};