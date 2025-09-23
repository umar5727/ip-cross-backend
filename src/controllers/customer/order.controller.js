const { Order, OrderProduct, OrderHistory, OrderStatus, OrderTotal, Customer, Product, ProductDescription, ProductImage } = require('../../models');
const { Op } = require('sequelize');

// Get all orders with pagination and comprehensive data
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Get status filter from query params
    const startDate = req.query.start_date; // Get start date filter
    const endDate = req.query.end_date; // Get end date filter
    
    // If customer is requesting their own orders
    const customerId = req.customer.customer_id;

    // Build where clause
    const whereClause = { customer_id: customerId };
    if (status) {
      whereClause.order_status_id = parseInt(status);
    }
    
    // Add date filtering
    if (startDate || endDate) {
      whereClause.date_added = {};
      if (startDate) {
        whereClause.date_added[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        // Add 23:59:59 to end date to include the entire day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.date_added[Op.lte] = endDateTime;
      }
    }

    const orders = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: OrderStatus,
          as: 'order_status',
          attributes: ['name']
        },
        {
          model: OrderProduct,
          as: 'OrderProducts',
          include: [
            {
              model: Product,
              as: 'Product',
              include: [
                {
                  model: ProductDescription,
                  as: 'ProductDescriptions',
                  where: { language_id: 1 },
                  required: false,
                  attributes: ['name']
                },
                {
                  model: ProductImage,
                  as: 'ProductImages',
                  where: { sort_order: 0 },
                  required: false,
                  attributes: ['image']
                }
              ],
              attributes: ['model', 'sku', 'price']
            }
          ],
          attributes: ['order_product_id', 'product_id', 'name', 'model', 'quantity', 'price', 'total']
        }
      ],
      limit,
      offset,
      order: [['date_added', 'DESC']]
    });

    // Format the response to match OpenCart structure
    const formattedOrders = orders.rows.map(order => {
      const orderData = order.toJSON();
      
      // Get product names and images
      const productNames = orderData.OrderProducts.map(op => op.Product?.ProductDescriptions?.[0]?.name || op.name).join(', ');
      const productImages = orderData.OrderProducts.map(op => op.Product?.ProductImages?.[0]?.image).filter(img => img);
      
      return {
        order_id: orderData.order_id,
        invoice_no: orderData.invoice_no,
        firstname: orderData.firstname,
        lastname: orderData.lastname,
        order_status: orderData.order_status?.name || 'Unknown',
        order_status_id: orderData.order_status_id,
        date_added: orderData.date_added,
        total: orderData.total,
        currency_code: orderData.currency_code,
        awbno: orderData.awbno,
        product_names: productNames,
        product_images: productImages,
        comment: orderData.comment
      };
    });

    res.status(200).json({
      success: true,
      count: orders.count,
      data: formattedOrders,
      totalPages: Math.ceil(orders.count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve orders'
    });
  }
};

// Get detailed order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { order_id: req.params.id },
      include: [
        {
          model: OrderStatus,
          as: 'order_status',
          attributes: ['name']
        },
        {
          model: OrderProduct,
          as: 'OrderProducts',
          include: [
            {
              model: Product,
              as: 'Product',
              include: [
                {
                  model: ProductDescription,
                  as: 'ProductDescriptions',
                  where: { language_id: 1 },
                  required: false,
                  attributes: ['name']
                },
                {
                  model: ProductImage,
                  as: 'ProductImages',
                  where: { sort_order: 0 },
                  required: false,
                  attributes: ['image']
                }
              ],
              attributes: ['model', 'sku', 'price']
            }
          ],
          attributes: ['order_product_id', 'product_id', 'name', 'model', 'quantity', 'price', 'total']
        },
        {
          model: OrderTotal,
          as: 'OrderTotals',
          attributes: ['order_total_id', 'code', 'title', 'value', 'sort_order']
        },
        {
          model: OrderHistory,
          as: 'OrderHistories',
          include: [
            {
              model: OrderStatus,
              as: 'order_status',
              attributes: ['name']
            }
          ],
          attributes: ['order_history_id', 'order_status_id', 'notify', 'comment', 'date_added'],
          order: [['date_added', 'DESC']]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if the order belongs to the authenticated customer
    if (order.customer_id !== req.customer.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }

    const orderData = order.toJSON();

    // Format the response
    const formattedOrder = {
      order_id: orderData.order_id,
      invoice_no: orderData.invoice_no,
      invoice_prefix: orderData.invoice_prefix,
      store_name: orderData.store_name,
      store_url: orderData.store_url,
      customer_id: orderData.customer_id,
      firstname: orderData.firstname,
      lastname: orderData.lastname,
      email: orderData.email,
      telephone: orderData.telephone,
      payment_firstname: orderData.payment_firstname,
      payment_lastname: orderData.payment_lastname,
      payment_address_1: orderData.payment_address_1,
      payment_city: orderData.payment_city,
      payment_postcode: orderData.payment_postcode,
      payment_country: orderData.payment_country,
      payment_zone: orderData.payment_zone,
      payment_method: orderData.payment_method,
      shipping_firstname: orderData.shipping_firstname,
      shipping_lastname: orderData.shipping_lastname,
      shipping_address_1: orderData.shipping_address_1,
      shipping_city: orderData.shipping_city,
      shipping_postcode: orderData.shipping_postcode,
      shipping_country: orderData.shipping_country,
      shipping_zone: orderData.shipping_zone,
      shipping_method: orderData.shipping_method,
      total: orderData.total,
      order_status: orderData.order_status?.name || 'Unknown',
      order_status_id: orderData.order_status_id,
      currency_code: orderData.currency_code,
      currency_value: orderData.currency_value,
      awbno: orderData.awbno,
      comment: orderData.comment,
      date_added: orderData.date_added,
      date_modified: orderData.date_modified,
      products: orderData.OrderProducts.map(op => ({
        order_product_id: op.order_product_id,
        product_id: op.product_id,
        name: op.Product?.ProductDescriptions?.[0]?.name || op.name,
        model: op.model,
        quantity: op.quantity,
        price: op.price,
        total: op.total,
        image: op.Product?.ProductImages?.[0]?.image
      })),
      totals: orderData.OrderTotals.map(ot => ({
        order_total_id: ot.order_total_id,
        code: ot.code,
        title: ot.title,
        value: ot.value,
        sort_order: ot.sort_order
      })),
      history: orderData.OrderHistories.map(oh => ({
        order_history_id: oh.order_history_id,
        order_status: oh.order_status?.name || 'Unknown',
        order_status_id: oh.order_status_id,
        notify: oh.notify,
        comment: oh.comment,
        date_added: oh.date_added
      }))
    };

    res.status(200).json({
      success: true,
      data: formattedOrder
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve order'
    });
  }
};

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const {
      payment_firstname,
      payment_lastname,
      payment_address_1,
      payment_city,
      payment_postcode,
      payment_country,
      payment_country_id,
      payment_zone,
      payment_zone_id,
      payment_method,
      payment_code,
      shipping_firstname,
      shipping_lastname,
      shipping_address_1,
      shipping_city,
      shipping_postcode,
      shipping_country,
      shipping_country_id,
      shipping_zone,
      shipping_zone_id,
      shipping_method,
      shipping_code,
      total,
      products
    } = req.body;

    // Get customer information
    const customer = req.customer;

    // Create order
    const order = await Order.create({
      invoice_no: 0, // Will be updated after order creation
      invoice_prefix: 'INV',
      store_id: 0,
      store_name: 'Default Store',
      store_url: process.env.STORE_URL || 'http://localhost:3000',
      customer_id: customer.customer_id,
      customer_group_id: customer.customer_group_id,
      firstname: customer.firstname,
      lastname: customer.lastname,
      email: customer.email,
      telephone: customer.telephone,
      payment_firstname,
      payment_lastname,
      payment_address_1,
      payment_city,
      payment_postcode,
      payment_country,
      payment_country_id,
      payment_zone,
      payment_zone_id,
      payment_method,
      payment_code,
      shipping_firstname,
      shipping_lastname,
      shipping_address_1,
      shipping_city,
      shipping_postcode,
      shipping_country,
      shipping_country_id,
      shipping_zone,
      shipping_zone_id,
      shipping_method,
      shipping_code,
      total,
      order_status_id: 1, // Pending
      ip: req.ip,
      date_added: new Date(),
      date_modified: new Date()
    });

    // Update invoice number
    await order.update({
      invoice_no: order.order_id
    });

    // TODO: Create order products (would be implemented in a real system)

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not create order'
    });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { order_status_id } = req.body;
    
    // Check if order exists
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if the order belongs to the authenticated customer
    if (order.customer_id !== req.customer.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }

    // Update order status
    await order.update({
      order_status_id,
      date_modified: new Date()
    });

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update order status'
    });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Check if order exists
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if the order belongs to the authenticated customer
    if (order.customer_id !== req.customer.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled (status is pending or processing)
    if (![1, 2].includes(order.order_status_id)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled in its current status'
      });
    }

    // Update order status to cancelled (7)
    await order.update({
      order_status_id: 7,
      date_modified: new Date()
    });

    // Add order history entry
    await OrderHistory.create({
      order_id: orderId,
      order_status_id: 7,
      notify: true,
      comment: 'Order cancelled by customer',
      date_added: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not cancel order'
    });
  }
};

// Get order statuses
exports.getOrderStatuses = async (req, res) => {
  try {
    const orderStatuses = await OrderStatus.findAll({
      where: { language_id: 1 },
      attributes: ['order_status_id', 'name'],
      order: [['order_status_id', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: orderStatuses
    });
  } catch (error) {
    console.error('Get order statuses error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve order statuses'
    });
  }
};

// Get order history for a specific order
exports.getOrderHistory = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Check if order exists and belongs to customer
    const order = await Order.findOne({
      where: { 
        order_id: orderId,
        customer_id: req.customer.customer_id 
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderHistory = await OrderHistory.findAll({
      where: { order_id: orderId },
      include: [
        {
          model: OrderStatus,
          as: 'order_status',
          attributes: ['name']
        }
      ],
      order: [['date_added', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: orderHistory
    });
  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve order history'
    });
  }
};

// Track order by AWB number
exports.trackOrder = async (req, res) => {
  try {
    const { awbno } = req.params;
    
    const order = await Order.findOne({
      where: { 
        awbno: awbno,
        customer_id: req.customer.customer_id 
      },
      include: [
        {
          model: OrderStatus,
          as: 'order_status',
          attributes: ['name']
        },
        {
          model: OrderHistory,
          as: 'OrderHistories',
          include: [
            {
              model: OrderStatus,
              as: 'order_status',
              attributes: ['name']
            }
          ],
          order: [['date_added', 'DESC']]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with this AWB number'
      });
    }

    const orderData = order.toJSON();

    res.status(200).json({
      success: true,
      data: {
        order_id: orderData.order_id,
        awbno: orderData.awbno,
        order_status: orderData.order_status?.name || 'Unknown',
        order_status_id: orderData.order_status_id,
        date_added: orderData.date_added,
        tracking_history: orderData.OrderHistories.map(oh => ({
          status: oh.order_status?.name || 'Unknown',
          comment: oh.comment,
          date_added: oh.date_added,
          notify: oh.notify
        }))
      }
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not track order'
    });
  }
};