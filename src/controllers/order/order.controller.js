const { Order, Customer } = require('../../models');

// Get all orders with pagination
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // If customer is requesting their own orders
    const customerId = req.customer.customer_id;

    const orders = await Order.findAndCountAll({
      where: { customer_id: customerId },
      limit,
      offset,
      order: [['date_added', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: orders.count,
      data: orders.rows,
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

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

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

    res.status(200).json({
      success: true,
      data: order
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

    // Update order status to cancelled (5)
    await order.update({
      order_status_id: 5,
      date_modified: new Date()
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