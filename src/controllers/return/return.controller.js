const { Return, ReturnImage, ReturnReason, ReturnStatus, Order, Product } = require('../../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

// Create a new return request
exports.createReturn = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      order_id,
      order_date,
      product_name,
      product_code,
      quantity,
      product_opened,
      images = [],
      other_details
    } = req.body;

    // Validate required fields
    if (!firstname || !lastname || !email || !order_id || !product_name || !product_code || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: firstname, lastname, email, order_id, product_name, product_code, quantity are required'
      });
    }

    // Validate order exists and belongs to customer
    const order = await Order.findOne({
      where: {
        order_id: order_id,
        customer_id: req.customer.customer_id
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to you'
      });
    }

    // Get product_id from product_code/model
    const product = await Product.findOne({
      where: {
        model: product_code
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with the provided code'
      });
    }

    // Convert product_opened to boolean
    const opened = product_opened === 'yes' || product_opened === true || product_opened === 1;

    // Create return record
    const returnData = await Return.create({
      order_id: order_id,
      product_id: product.product_id,
      customer_id: req.customer.customer_id,
      firstname: firstname,
      lastname: lastname,
      email: email,
      telephone: req.customer.telephone || '',
      product: product_name,
      model: product_code,
      quantity: parseInt(quantity),
      opened: opened,
      return_reason_id: 1, // Default reason - can be made configurable
      return_action_id: 1, // Default action - can be made configurable
      return_status_id: 1, // Pending status
      comment: other_details || '',
      date_ordered: order_date || order.date_added,
      date_added: new Date(),
      date_modified: new Date()
    });

    // Handle image uploads if provided
    if (images && images.length > 0) {
      const uploadDir = path.join(__dirname, '../../uploads/returns');
      
      // Create upload directory if it doesn't exist
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        // Directory might already exist, ignore error
      }

      for (let i = 0; i < Math.min(images.length, 4); i++) {
        const imageData = images[i];
        
        if (imageData) {
          try {
            // Handle base64 image data
            let imageBuffer;
            let filename;
            
            if (imageData.startsWith('data:image/')) {
              // Base64 image data
              const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
              imageBuffer = Buffer.from(base64Data, 'base64');
              
              // Extract file extension from data URL
              const extension = imageData.split(';')[0].split('/')[1];
              filename = `return_${returnData.return_id}_${i + 1}.${extension}`;
            } else {
              // Assume it's already base64 without data URL prefix
              imageBuffer = Buffer.from(imageData, 'base64');
              filename = `return_${returnData.return_id}_${i + 1}.jpg`;
            }

            const filePath = path.join(uploadDir, filename);
            await fs.writeFile(filePath, imageBuffer);

            // Save image record to database
            await ReturnImage.create({
              return_id: returnData.return_id,
              image: `uploads/returns/${filename}`,
              sort_order: i + 1
            });
          } catch (imageError) {
            console.error('Error saving image:', imageError);
            // Continue with other images even if one fails
          }
        }
      }
    }

    // Get return status name
    const returnStatus = await ReturnStatus.findOne({
      where: {
        return_status_id: returnData.return_status_id,
        language_id: 1
      }
    });

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully',
      data: {
        return_id: returnData.return_id,
        status: returnStatus?.name || 'Pending',
        return_status_id: returnData.return_status_id,
        date_added: returnData.date_added
      }
    });
  } catch (error) {
    console.error('Create return error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not create return request'
    });
  }
};

// Get all returns for authenticated customer
exports.getCustomerReturns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    // Build where clause
    const whereClause = { customer_id: req.customer.customer_id };
    
    if (status) {
      whereClause.return_status_id = parseInt(status);
    }
    
    // Add date filtering
    if (startDate || endDate) {
      whereClause.date_added = {};
      if (startDate) {
        whereClause.date_added[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.date_added[Op.lte] = endDateTime;
      }
    }

    const returns = await Return.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ReturnStatus,
          as: 'ReturnStatus',
          where: { language_id: 1 },
          required: false,
          attributes: ['name']
        },
        {
          model: ReturnImage,
          as: 'ReturnImages',
          attributes: ['return_image_id', 'image', 'sort_order'],
          order: [['sort_order', 'ASC']]
        }
      ],
      limit,
      offset,
      order: [['date_added', 'DESC']]
    });

    // Format the response
    const formattedReturns = returns.rows.map(returnItem => {
      const returnData = returnItem.toJSON();
      
      return {
        return_id: returnData.return_id,
        order_id: returnData.order_id,
        product: returnData.product,
        model: returnData.model,
        quantity: returnData.quantity,
        opened: returnData.opened,
        status: returnData.ReturnStatus?.name || 'Unknown',
        return_status_id: returnData.return_status_id,
        comment: returnData.comment,
        date_added: returnData.date_added,
        date_ordered: returnData.date_ordered,
        images: returnData.ReturnImages.map(img => ({
          return_image_id: img.return_image_id,
          image: img.image,
          sort_order: img.sort_order
        }))
      };
    });

    res.status(200).json({
      success: true,
      count: returns.count,
      data: formattedReturns,
      totalPages: Math.ceil(returns.count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get customer returns error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve returns'
    });
  }
};

// Get return by ID
exports.getReturnById = async (req, res) => {
  try {
    const returnId = req.params.id;

    const returnItem = await Return.findOne({
      where: {
        return_id: returnId,
        customer_id: req.customer.customer_id
      },
      include: [
        {
          model: ReturnStatus,
          as: 'ReturnStatus',
          where: { language_id: 1 },
          required: false,
          attributes: ['name']
        },
        {
          model: ReturnReason,
          as: 'ReturnReason',
          where: { language_id: 1 },
          required: false,
          attributes: ['name']
        },
        {
          model: ReturnImage,
          as: 'ReturnImages',
          attributes: ['return_image_id', 'image', 'sort_order'],
          order: [['sort_order', 'ASC']]
        }
      ]
    });

    if (!returnItem) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    const returnData = returnItem.toJSON();

    res.status(200).json({
      success: true,
      data: {
        return_id: returnData.return_id,
        order_id: returnData.order_id,
        product_id: returnData.product_id,
        firstname: returnData.firstname,
        lastname: returnData.lastname,
        email: returnData.email,
        telephone: returnData.telephone,
        product: returnData.product,
        model: returnData.model,
        quantity: returnData.quantity,
        opened: returnData.opened,
        status: returnData.ReturnStatus?.name || 'Unknown',
        return_status_id: returnData.return_status_id,
        reason: returnData.ReturnReason?.name || 'Not specified',
        return_reason_id: returnData.return_reason_id,
        comment: returnData.comment,
        date_added: returnData.date_added,
        date_ordered: returnData.date_ordered,
        date_modified: returnData.date_modified,
        images: returnData.ReturnImages.map(img => ({
          return_image_id: img.return_image_id,
          image: img.image,
          sort_order: img.sort_order
        }))
      }
    });
  } catch (error) {
    console.error('Get return by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve return'
    });
  }
};

// Get return statuses
exports.getReturnStatuses = async (req, res) => {
  try {
    const returnStatuses = await ReturnStatus.findAll({
      where: { language_id: 1 },
      attributes: ['return_status_id', 'name'],
      order: [['return_status_id', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: returnStatuses
    });
  } catch (error) {
    console.error('Get return statuses error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve return statuses'
    });
  }
};

// Get return reasons
exports.getReturnReasons = async (req, res) => {
  try {
    const returnReasons = await ReturnReason.findAll({
      where: { language_id: 1 },
      attributes: ['return_reason_id', 'name'],
      order: [['return_reason_id', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: returnReasons
    });
  } catch (error) {
    console.error('Get return reasons error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve return reasons'
    });
  }
};
