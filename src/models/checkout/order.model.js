/**
 * Order Model
 * Handles order creation, validation, and management
 */

const db = require('../../../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Order Model
 */
class OrderModel {
  /**
   * Add a new order to the database
   * @param {Object} transaction - Database transaction
   * @param {Object} orderData - Order data
   * @returns {Number} Order ID
   */
  async addOrder(transaction, orderData) {
    const {
      customer_id,
      firstname,
      lastname,
      email,
      telephone,
      payment_firstname,
      payment_lastname,
      payment_address_1,
      payment_address_2,
      payment_city,
      payment_postcode,
      payment_country,
      payment_country_id,
      payment_zone,
      payment_zone_id,
      shipping_firstname,
      shipping_lastname,
      shipping_address_1,
      shipping_address_2,
      shipping_city,
      shipping_postcode,
      shipping_country,
      shipping_country_id,
      shipping_zone,
      shipping_zone_id,
      payment_method,
      payment_code,
      shipping_method,
      shipping_code,
      comment,
      total,
      ip,
      user_agent,
      order_status_id = 0, // Default to pending (0) unless specified
      parent_order_id = null,
      alternate_mobile_number = null,
      gst_no = null
    } = orderData;

    // Insert order into database
    const [result] = await connection.query(
      `INSERT INTO \`order\` SET
      customer_id = ?,
      firstname = ?,
      lastname = ?,
      email = ?,
      telephone = ?,
      payment_firstname = ?,
      payment_lastname = ?,
      payment_address_1 = ?,
      payment_address_2 = ?,
      payment_city = ?,
      payment_postcode = ?,
      payment_country = ?,
      payment_country_id = ?,
      payment_zone = ?,
      payment_zone_id = ?,
      shipping_firstname = ?,
      shipping_lastname = ?,
      shipping_address_1 = ?,
      shipping_address_2 = ?,
      shipping_city = ?,
      shipping_postcode = ?,
      shipping_country = ?,
      shipping_country_id = ?,
      shipping_zone = ?,
      shipping_zone_id = ?,
      payment_method = ?,
      payment_code = ?,
      shipping_method = ?,
      shipping_code = ?,
      comment = ?,
      total = ?,
      ip = ?,
      user_agent = ?,
      order_status_id = ?,
      parent_order_id = ?,
      alternate_mobile_number = ?,
      gst_no = ?,
      date_added = NOW(),
      date_modified = NOW()`,
      [
        customer_id,
        firstname,
        lastname,
        email,
        telephone,
        payment_firstname,
        payment_lastname,
        payment_address_1,
        payment_address_2,
        payment_city,
        payment_postcode,
        payment_country,
        payment_country_id,
        payment_zone,
        payment_zone_id,
        shipping_firstname,
        shipping_lastname,
        shipping_address_1,
        shipping_address_2,
        shipping_city,
        shipping_postcode,
        shipping_country,
        shipping_country_id,
        shipping_zone,
        shipping_zone_id,
        payment_method,
        payment_code,
        shipping_method,
        shipping_code,
        comment,
        total,
        ip,
        user_agent,
        order_status_id,
        parent_order_id,
        alternate_mobile_number,
        gst_no
      ]
    );

    return result.insertId;
  }

  /**
   * Add order products
   * @param {Object} connection - Database connection
   * @param {Number} orderId - Order ID
   * @param {Array} products - Order products
   */
  async addOrderProducts(connection, orderId, products) {
    for (const product of products) {
      await connection.query(
        `INSERT INTO order_product SET
        order_id = ?,
        product_id = ?,
        name = ?,
        model = ?,
        quantity = ?,
        price = ?,
        total = ?,
        tax = ?`,
        [
          orderId,
          product.product_id,
          product.name,
          product.model || '',
          product.quantity,
          product.price,
          product.total,
          product.tax || 0
        ]
      );

      // Add product options if any
      if (product.options && product.options.length > 0) {
        for (const option of product.options) {
          await connection.query(
            `INSERT INTO order_option SET
            order_id = ?,
            order_product_id = LAST_INSERT_ID(),
            product_option_id = ?,
            product_option_value_id = ?,
            name = ?,
            value = ?,
            type = ?`,
            [
              orderId,
              option.product_option_id,
              option.product_option_value_id,
              option.name,
              option.value,
              option.type || 'select'
            ]
          );
        }
      }
    }
  }

  /**
   * Add order totals
   * @param {Object} connection - Database connection
   * @param {Number} orderId - Order ID
   * @param {Array} totals - Order totals
   */
  async addOrderTotals(connection, orderId, totals) {
    for (const total of totals) {
      await connection.query(
        `INSERT INTO order_total SET
        order_id = ?,
        code = ?,
        title = ?,
        value = ?,
        sort_order = ?`,
        [
          orderId,
          total.code,
          total.title,
          total.value,
          total.sort_order
        ]
      );
    }
  }

  /**
   * Create a parent order for split orders
   * @param {Object} connection - Database connection
   * @param {Number} customerId - Customer ID
   * @param {Object} orderData - Order data
   * @returns {Number} Parent order ID
   */
  async createParentOrder(connection, customerId, orderData) {
    const {
      payment_method,
      payment_code,
      shipping_method,
      shipping_code,
      ip,
      user_agent,
      voucher_code,
      referral_code
    } = orderData;

    // Get customer details
    const [customerResult] = await connection.query(
      'SELECT * FROM customer WHERE customer_id = ?',
      [customerId]
    );

    if (!customerResult.length) {
      throw new Error('Customer not found');
    }

    const customer = customerResult[0];

    // Insert parent order
    const [result] = await connection.query(
      `INSERT INTO parent_order SET
      customer_id = ?,
      firstname = ?,
      lastname = ?,
      email = ?,
      telephone = ?,
      payment_method = ?,
      payment_code = ?,
      shipping_method = ?,
      shipping_code = ?,
      ip = ?,
      user_agent = ?,
      voucher_code = ?,
      referral_code = ?,
      date_added = NOW(),
      date_modified = NOW()`,
      [
        customerId,
        customer.firstname,
        customer.lastname,
        customer.email,
        customer.telephone,
        payment_method,
        payment_code,
        shipping_method,
        shipping_code,
        ip,
        user_agent,
        voucher_code,
        referral_code
      ]
    );

    return result.insertId;
  }

  /**
   * Update order status
   * @param {Object} connection - Database connection
   * @param {Number} orderId - Order ID
   * @param {Number} orderStatusId - Order status ID
   * @param {String} comment - Comment (optional)
   */
  async updateOrderStatus(connection, orderId, orderStatusId, comment = '') {
    // Update order status
    await connection.query(
      `UPDATE \`order\` SET
      order_status_id = ?,
      date_modified = NOW()
      WHERE order_id = ?`,
      [orderStatusId, orderId]
    );

    // Add order history
    await connection.query(
      `INSERT INTO order_history SET
      order_id = ?,
      order_status_id = ?,
      notify = 0,
      comment = ?,
      date_added = NOW()`,
      [orderId, orderStatusId, comment]
    );
  }

  /**
   * Get order by ID
   * @param {Object} connection - Database connection
   * @param {Number} orderId - Order ID
   * @returns {Object} Order data
   */
  async getOrder(connection, orderId) {
    const [orderResult] = await connection.query(
      'SELECT * FROM `order` WHERE order_id = ?',
      [orderId]
    );

    if (!orderResult.length) {
      return null;
    }

    const order = orderResult[0];

    // Get order products
    const [productsResult] = await connection.query(
      'SELECT * FROM order_product WHERE order_id = ?',
      [orderId]
    );

    order.products = productsResult;

    // Get order totals
    const [totalsResult] = await connection.query(
      'SELECT * FROM order_total WHERE order_id = ? ORDER BY sort_order',
      [orderId]
    );

    order.totals = totalsResult;

    return order;
  }

  /**
   * Update product stock
   * @param {Object} connection - Database connection
   * @param {Array} products - Order products
   */
  async updateProductStock(connection, products) {
    for (const product of products) {
      await connection.query(
        'UPDATE product SET quantity = quantity - ? WHERE product_id = ?',
        [product.quantity, product.product_id]
      );
    }
  }
}

module.exports = new OrderModel();