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
    // Allowed file extensions
    const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt)$/i;
    
    // Allowed MIME types
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    const extname = allowedExtensions.test(file.originalname.toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype.toLowerCase());
    
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
    // Return the same categories that are used in createTicket validation
    res.status(200).json({
      success: true,
      categories: TICKET_CATEGORIES
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
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'attachment', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 1 }
  ]),
  (error, req, res, next) => {
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size allowed is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + error.message
      });
    } else if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next();
  },
  async (req, res) => {
    try {
      const { subject, category_id, description } = req.body;
      const customer_id = req.customer?.customer_id;

      // Validation
      if (!customer_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to create ticket'
        });
      }

      if (!subject || !category_id || !description) {
        return res.status(400).json({
          success: false,
          message: 'All fields (subject, category_id, description) are required'
        });
      }

      // Validate category_id
      const validCategoryIds = Object.keys(TICKET_CATEGORIES).map(id => parseInt(id));
      if (!validCategoryIds.includes(parseInt(category_id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category_id selected'
        });
      }

      // Get category name from category_id
      const categoryName = TICKET_CATEGORIES[category_id];

      const ticketData = {
        customer_id,
        subject,
        category: categoryName, // Use category name instead of category_id
        description,
        status: 'open',
        file: '',
        date_added: new Date()
      };

      // Add file if uploaded (check multiple possible field names)
      let uploadedFile = null;
      if (req.files) {
        // Check for files in any of the accepted field names
        if (req.files.file && req.files.file[0]) {
          uploadedFile = req.files.file[0];
        } else if (req.files.attachment && req.files.attachment[0]) {
          uploadedFile = req.files.attachment[0];
        } else if (req.files.image && req.files.image[0]) {
          uploadedFile = req.files.image[0];
        } else if (req.files.document && req.files.document[0]) {
          uploadedFile = req.files.document[0];
        }
      }
      
      if (uploadedFile) {
        ticketData.file = uploadedFile.filename;
      }

      const ticket = await Ticket.create(ticketData);

      res.status(201).json({
        success: true,
        message: 'Your ticket has been submitted successfully',
        data: {
          ticket_id: ticket.ticket_id,
          subject: ticket.subject,
          category: ticket.category,
          category_id: parseInt(category_id), // Include both for API compatibility
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
    const customer_id = req.customer?.customer_id;
    
    if (!customer_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view tickets'
      });
    }
    
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
    const customer_id = req.customer?.customer_id;
    
    if (!customer_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view ticket'
      });
    }

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
          as: 'TicketReplies',
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

    // Format ticket data (matching OpenCart structure)
    const formattedTicket = {
      ticket_id: ticket.ticket_id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      file: ticket.file,
      date_added: ticket.date_added,
      customer_name: ticket.Customer ? `${ticket.Customer.firstname} ${ticket.Customer.lastname}` : 'Unknown Customer',
      firstname: ticket.Customer?.firstname || '',
      lastname: ticket.Customer?.lastname || '',
      replies: (ticket.TicketReplies || []).map(reply => ({
        reply_id: reply.reply_id,
        ticket_id: reply.ticket_id,
        customer_id: reply.customer_id,
        message: reply.message,
        file: reply.file,
        user_type: reply.user_type,
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
  (error, req, res, next) => {
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size allowed is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + error.message
      });
    } else if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next();
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const customer_id = req.customer?.customer_id;

      if (!customer_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to add reply'
        });
      }

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

      // Update ticket status to indicate customer replied
      await ticket.update({ 
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

// Update ticket status (matching OpenCart functionality)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const customer_id = req.customer?.customer_id;

    if (!customer_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to update ticket status'
      });
    }

    // Validate status
    const validStatuses = ['open', 'pending', 'closed', 'customer-reply'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
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

    // Update ticket status
    await ticket.update({ status });

    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      data: {
        ticket_id: ticket.ticket_id,
        status: ticket.status
      }
    });

  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update ticket status'
    });
  }
};

module.exports = {
  createTicket: exports.createTicket,
  getCustomerTickets: exports.getCustomerTickets,
  getTicketById: exports.getTicketById,
  addReply: exports.addReply,
  getTicketCategories: exports.getTicketCategories,
  updateStatus: exports.updateStatus,
  upload
};