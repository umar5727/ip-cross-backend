/**
 * Order Model
 * Handles order creation, validation, and management
 */

const sequelize = require('../../../config/database');
const { QueryTypes, DataTypes } = require('sequelize');
const db = require('../../../config/database');

// Define Order model
const Order = sequelize.define('order', {
  order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_id: DataTypes.INTEGER,
  firstname: DataTypes.STRING,
  lastname: DataTypes.STRING,
  email: DataTypes.STRING,
  telephone: DataTypes.STRING,
  payment_firstname: DataTypes.STRING,
  payment_lastname: DataTypes.STRING,
  payment_address_1: DataTypes.STRING,
  payment_address_2: DataTypes.STRING,
  payment_city: DataTypes.STRING,
  payment_postcode: DataTypes.STRING,
  payment_country: DataTypes.STRING,
  payment_country_id: DataTypes.INTEGER,
  payment_zone: DataTypes.STRING,
  payment_zone_id: DataTypes.INTEGER,
  shipping_firstname: DataTypes.STRING,
  shipping_lastname: DataTypes.STRING,
  shipping_address_1: DataTypes.STRING,
  shipping_address_2: DataTypes.STRING,
  shipping_city: DataTypes.STRING,
  shipping_postcode: DataTypes.STRING,
  shipping_country: DataTypes.STRING,
  shipping_country_id: DataTypes.INTEGER,
  shipping_zone: DataTypes.STRING,
  shipping_zone_id: DataTypes.INTEGER,
  payment_method: DataTypes.STRING,
  payment_code: DataTypes.STRING,
  shipping_method: DataTypes.STRING,
  shipping_code: DataTypes.STRING,
  alternate_mobile: DataTypes.STRING,
  gstin: DataTypes.STRING,
  comment: DataTypes.TEXT,
  total: DataTypes.DECIMAL(15, 4),
  ip: DataTypes.STRING,
  user_agent: DataTypes.STRING,
  order_status_id: DataTypes.INTEGER,
  parent_order_id: DataTypes.INTEGER,
  alternate_mobile_number: DataTypes.STRING,
  gstin: DataTypes.STRING
}, {
  tableName: 'oc_order',
  timestamps: false,
  createdAt: 'date_added',
  updatedAt: 'date_modified'
});

// Define OrderProduct model
const OrderProduct = sequelize.define('order_product', {
  order_product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: DataTypes.INTEGER,
  product_id: DataTypes.INTEGER,
  name: DataTypes.STRING,
  model: DataTypes.STRING,
  quantity: DataTypes.INTEGER,
  price: DataTypes.INTEGER,
  total: DataTypes.DECIMAL(15, 4),
  tax: DataTypes.DECIMAL(15, 4),
  reward: DataTypes.INTEGER,
  courier_charges: DataTypes.DECIMAL(10, 2)
}, {
  tableName: 'oc_order_product',
  timestamps: false
});

// Define OrderTotal model
const OrderTotal = sequelize.define('order_total', {
  order_total_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: DataTypes.INTEGER,
  code: DataTypes.STRING,
  title: DataTypes.STRING,
  value: DataTypes.DECIMAL(15, 4),
  sort_order: DataTypes.INTEGER
}, {
  tableName: 'oc_order_total',
  timestamps: false
});

// Define ParentOrder model
const ParentOrder = sequelize.define('parent_order', {
  parent_order_id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  order_ids: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: '[]'
  },
  courier_charges: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  date_added: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('NOW()')
  },
  date_modified: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('NOW()'),
    onUpdate: sequelize.literal('NOW()')
  }
}, {
  tableName: 'oc_order_parent',
  timestamps: false
});

// Define relationships
Order.hasMany(OrderProduct, { foreignKey: 'order_id' });
Order.hasMany(OrderTotal, { foreignKey: 'order_id' });
ParentOrder.hasMany(Order, { foreignKey: 'parent_order_id' });

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
    const order = await Order.create({
      customer_id: orderData.customer_id,
      firstname: orderData.firstname,
      lastname: orderData.lastname,
      email: orderData.email,
      telephone: orderData.telephone,
      payment_firstname: orderData.payment_firstname,
      payment_lastname: orderData.payment_lastname,
      payment_address_1: orderData.payment_address_1,
      payment_address_2: orderData.payment_address_2,
      payment_city: orderData.payment_city,
      payment_postcode: orderData.payment_postcode,
      payment_country: orderData.payment_country,
      payment_country_id: orderData.payment_country_id,
      payment_zone: orderData.payment_zone,
      payment_zone_id: orderData.payment_zone_id,
      shipping_firstname: orderData.shipping_firstname,
      shipping_lastname: orderData.shipping_lastname,
      shipping_address_1: orderData.shipping_address_1,
      shipping_address_2: orderData.shipping_address_2,
      shipping_city: orderData.shipping_city,
      shipping_postcode: orderData.shipping_postcode,
      shipping_country: orderData.shipping_country,
      shipping_country_id: orderData.shipping_country_id,
      shipping_zone: orderData.shipping_zone,
      shipping_zone_id: orderData.shipping_zone_id,
      payment_method: orderData.payment_method,
      payment_code: orderData.payment_code,
      shipping_method: orderData.shipping_method,
      shipping_code: orderData.shipping_code,
      comment: orderData.comment,
      total: orderData.total,
      ip: orderData.ip,
      user_agent: orderData.user_agent,
      order_status_id: orderData.order_status_id || 0,
      parent_order_id: orderData.parent_order_id || null,
      alternate_mobile: orderData.alternate_mobile_number || null,
      gstin: orderData.gst_no || null,
      date_added: sequelize.literal('NOW()'),
      date_modified: sequelize.literal('NOW()')
    }, { transaction });

    return order.order_id;
  }

  /**
   * Add order products
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Array} products - Order products
   */
  async addOrderProducts(transaction, orderId, products) {
    const orderProducts = products.map(product => ({
      order_id: orderId,
      product_id: product.product_id,
      name: product.name,
      model: product.model || '',
      quantity: product.quantity,
      price: product.price,
      total: product.total,
      tax: product.tax || 0
    }));

    await OrderProduct.bulkCreate(orderProducts, { transaction });
  }

  /**
   * Add order totals
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Array} totals - Order totals
   */
  async addOrderTotals(transaction, orderId, totals) {
    // Check if totals is an array before mapping
    if (!Array.isArray(totals)) {
      console.log('Warning: totals is not an array in addOrderTotals', totals);
      return; // Exit early if totals is not an array
    }
    
    const orderTotals = totals.map(total => ({
      order_id: orderId,
      code: total.code,
      title: total.title,
      value: total.value,
      sort_order: total.sort_order
    }));

    await OrderTotal.bulkCreate(orderTotals, { transaction });
  }

  /**
   * Create a parent order for split orders
   * @param {Object} transaction - Database transaction
   * @param {Object} orderData - Order data with order_ids, courier_charges, and total
   * @returns {String} Parent order ID string
   */
  async createParentOrder(transaction, orderData) {
    console.log('createParentOrder called with transaction type:', typeof transaction);
    
    // Ensure orderData is defined
    if (!orderData) {
      console.warn('Warning: orderData is undefined in createParentOrder');
      orderData = {};
    }
    
    // Generate a unique parent_order_id (timestamp + random string)
    const uniqueParentOrderId = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14) + 
      '-' + Math.random().toString(36).substring(2, 10);
    
    // Insert parent order
    const parentOrder = await ParentOrder.create({
      parent_order_id: uniqueParentOrderId,
      order_ids: '[]', // Always use valid JSON empty array
      courier_charges: orderData.courier_charges || 0,
      total: orderData.total || 0
    }, { transaction });

    return uniqueParentOrderId;
  }

  /**
   * Update order status
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Number} orderStatusId - Order status ID
   * @param {String} comment - Comment (optional)
   */
  async updateOrderStatus(transaction, orderId, orderStatusId, comment = '') {
    // Update order status
    await Order.update({
      order_status_id: orderStatusId,
      date_modified: sequelize.literal('NOW()')
    }, {
      where: { order_id: orderId },
      transaction
    });

    // Add order history
    await sequelize.query(
      `INSERT INTO order_history SET
      order_id = :orderId,
      order_status_id = :orderStatusId,
      notify = 0,
      comment = :comment,
      date_added = NOW()`,
      {
        replacements: { orderId, orderStatusId, comment },
        type: QueryTypes.INSERT,
        transaction
      }
    );
  }

  /**
   * Get order by ID
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @returns {Object} Order data
   */
  async getOrder(transaction, orderId) {
    const order = await Order.findByPk(orderId, {
      transaction,
      raw: true
    });

    if (!order) {
      return null;
    }

    // Get order products
    const products = await OrderProduct.findAll({
      where: { order_id: orderId },
      transaction,
      raw: true
    });

    order.products = products;

    // Get order totals
    const totals = await OrderTotal.findAll({
      where: { order_id: orderId },
      order: [['sort_order', 'ASC']],
      transaction,
      raw: true
    });

    order.totals = totals;

    return order;
  }

  /**
   * Update product stock
   * @param {Object} transaction - Database transaction
   * @param {Array} products - Order products
   */
  async updateProductStock(transaction, products) {
    for (const product of products) {
      await sequelize.query(
        'UPDATE oc_product SET quantity = quantity - :quantity WHERE product_id = :productId',
        {
          replacements: { 
            quantity: product.quantity, 
            productId: product.product_id 
          },
          type: QueryTypes.UPDATE,
          transaction
        }
      );
    }
  }

  /**
   * Update parent order with order IDs
   * @param {Object} transaction - Database transaction
   * @param {String} parentOrderId - Parent order ID string
   * @param {Array} orderIds - Array of order IDs
   * @param {Number} total - Total amount
   * @param {Number} courierCharges - Courier charges
   * @returns {Boolean} Success
   */
  async updateParentOrder(transaction, parentOrderId, orderIds, total, courierCharges) {
    console.log('Updating parent order:', parentOrderId, 'with order IDs:', orderIds.join(','));
    
    await ParentOrder.update({
      order_ids: orderIds.join(','),
      total: total,
      courier_charges: courierCharges
    }, {
      where: { parent_order_id: parentOrderId },
      transaction
    });
    
    return true;
  }

  /**
   * Get first time discount percentage for a customer
   * @param {Number} customerId - Customer ID
   * @returns {Number|null} Discount percentage or null
   */
  async getFirstTimeDiscountPct(customerId) {
    // This is a placeholder - implement according to your business logic
    const orderCount = await Order.count({
      where: { customer_id: customerId }
    });
    
    return orderCount === 0 ? 10 : null; // 10% discount for first purchase
  }

  /**
   * Get courier charges for a product based on customer postcode
   * @param {Number} product_id - Product ID
   * @param {String} customer_pincode - Customer postcode/pincode
   * @returns {Object} Courier charge information
   */
  async getCourierCharge(product_id, customer_pincode) {
    try {
      // Get vendor ID for the product
      const vendorQuery = await db.query(
        "SELECT vendor_id FROM oc_vendor_to_product WHERE product_id = ?",
        {
          replacements: [product_id],
          type: QueryTypes.SELECT
        }
      );
      
      const vendor_id = vendorQuery.length ? vendorQuery[0].vendor_id : 0;
      
      // Get vendor pincode
      const vendorPincodeQuery = await db.query(
        "SELECT postcode FROM oc_vendor WHERE vendor_id = ?",
        {
          replacements: [vendor_id],
          type: QueryTypes.SELECT
        }
      );
      
      const vendor_pincode = vendorPincodeQuery.length ? vendorPincodeQuery[0].postcode.toString().trim() : '';
      customer_pincode = customer_pincode.toString().trim();
      
      // Get vendor city and state
      const vendorLocationQuery = await db.query(
        "SELECT * FROM oc_city_pincode WHERE pincode = ?",
        {
          replacements: [vendor_pincode],
          type: QueryTypes.SELECT
        }
      );
      
      const vendor_city = vendorLocationQuery.length ? vendorLocationQuery[0].city : '';
      const vendor_state = vendorLocationQuery.length ? vendorLocationQuery[0].state : '';
      
      // Get customer city and state
      const customerLocationQuery = await db.query(
        "SELECT * FROM oc_city_pincode WHERE pincode = ?",
        {
          replacements: [customer_pincode],
          type: QueryTypes.SELECT
        }
      );
      
      const customer_city = customerLocationQuery.length ? customerLocationQuery[0].city : '';
      const customer_state = customerLocationQuery.length ? customerLocationQuery[0].state : '';
      
      // Determine delivery type
      let delivery_type;
      if (vendor_city === customer_city && vendor_state === customer_state) {
        delivery_type = 'local';
      } else if (vendor_state === customer_state) {
        delivery_type = 'zonal';
      } else {
        delivery_type = 'national';
      }
      
      // Get courier charges for product
      const chargesQuery = await db.query(
        "SELECT * FROM oc_product_courier_charges WHERE product_id = ?",
        {
          replacements: [product_id],
          type: QueryTypes.SELECT
        }
      );
      
      const charges = chargesQuery.length ? chargesQuery[0] : {};
      
      // Return only current delivery type charge
      const charge_map = {
        'local': charges.local_charges ? parseFloat(charges.local_charges) : null,
        'zonal': charges.zonal_charges ? parseFloat(charges.zonal_charges) : null,
        'national': charges.national_charges ? parseFloat(charges.national_charges) : null
      };
      
      return {
        delivery_type: delivery_type,
        courier_charge: charge_map[delivery_type],
        freeCharges: charges.courier_free_price ? parseFloat(charges.courier_free_price) : null,
        local_charges: charges.local_charges ? parseFloat(charges.local_charges) : 0,
        customer_city: customer_city,
        vendor_city: vendor_city,
        customer_pincode: customer_pincode
      };
    } catch (error) {
      console.error('Error in getCourierCharge:', error);
      return {
        delivery_type: 'national',
        courier_charge: 0,
        freeCharges: null,
        local_charges: 0,
        customer_city: '',
        vendor_city: '',
        customer_pincode: customer_pincode
      };
    }
  }



    async processPayment(transaction, payment_method, orderIds, requestData) {
    // Placeholder for your payment integration logic
    // Assuming success, mark orders as per payment method

    if (payment_method.code === 'cod') {
      await Order.update(
        { order_status_id: 2 },
        { where: { order_id: orderIds }, transaction }
      );
      return { success: true, data: { method: 'cod', status: 'processing', confirmed: true } };
    } else if (payment_method.code === 'razorpay') {
      // Create razorpay order & keep status=0 pending (awaiting payment)
      // Provide razorpay order id/checkout info in data
      return { success: true, data: { method: 'razorpay', order_id: 'rzp123456', status: 'awaiting_payment', confirmed: false } };
    } else {
      return { success: false, message: 'Unsupported payment method' };
    }
  }
}

module.exports = new OrderModel();