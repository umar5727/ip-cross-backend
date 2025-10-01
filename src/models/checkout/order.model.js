/**
 * Order Model
 * Handles order creation, validation, and management
 */

const sequelize = require('../../../config/database');
const { QueryTypes, DataTypes, Op } = require('sequelize');
const db = require('../../../config/database');
const VendorToProduct = require('../product/vendor_to_product.model'); //vendor to product
const VendorOrderProduct = require('../order/vendor_order_product.model'); //vendor order product
const OrderVendorHistory = require('../order/order_vendorhistory.model'); //order vendor history
const { v4: uuidv4 } = require('uuid');

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
  customer_group_id: DataTypes.INTEGER,
  language_id: DataTypes.INTEGER,
  currency_id: DataTypes.INTEGER,
  currency_code: DataTypes.STRING,
  store_name: DataTypes.STRING,
  store_url: DataTypes.STRING,
  date_added: DataTypes.DATE,
  date_modified: DataTypes.DATE,
  total_courier_charges: DataTypes.DECIMAL(15, 2),
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
  payment_telephone: DataTypes.STRING,
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
  shipping_telephone: DataTypes.STRING,
  payment_method: DataTypes.STRING,
  payment_code: DataTypes.STRING,
  shipping_method: DataTypes.STRING,
  shipping_code: DataTypes.STRING,
  alternate_mobile: DataTypes.STRING,
  gstin: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'NA'
  },
  comment: DataTypes.TEXT,
  total: DataTypes.DECIMAL(15, 2),
  ip: DataTypes.STRING,
  user_agent: DataTypes.STRING,
  order_status_id: DataTypes.INTEGER,
  parent_order_id: DataTypes.INTEGER,
  alternate_mobile_number: DataTypes.STRING
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
    console.log(`Creating order with courier charges: ${orderData.total_courier_charges}, store: ${orderData.store_name}`);
    
    const order = await Order.create({
      customer_id: orderData.customer_id,
      firstname: orderData.firstname,
      lastname: orderData.lastname,
      email: orderData.email,
      telephone: orderData.telephone,
      customer_group_id: orderData.customer_group_id || 1,
      language_id: orderData.language_id || 1,
      currency_id: orderData.currency_id || 4,
      currency_code: orderData.currency_code || 'INR',
      store_name: orderData.store_name || 'ipshopy',
      store_url: orderData.store_url || 'https://www.ipshopy.com/',
      total_courier_charges: orderData.total_courier_charges || 0,
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
      payment_telephone: orderData.payment_telephone,
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
      shipping_telephone: orderData.shipping_telephone,
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
      alternate_mobile: orderData.alternate_mobile || null,
      gstin: orderData.gstin || 'NA',
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
    const orderProducts = products.map(product => {
      const price = product.product_data?.price || 0;
      const quantity = product.quantity;
      const total = price * quantity;
      
      // Log what price is being saved to the order
      console.log(`Saving order product - ID: ${product.product_id}, Price: ${price}, Quantity: ${quantity}, Total: ${total}`);
      
      return {
        order_id: orderId,
        product_id: product.product_id,
        name: product.product_data?.name || '',
        model: product.product_data?.model || '',
        quantity: quantity,
        price: price,
        total: total,
        tax: product.tax || 0
      };
    });

    await OrderProduct.bulkCreate(orderProducts, { transaction });
  }

  /**
   * Add order totals
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Number} finalTotal - Final total value
   * @param {Number} courierCharge - Courier charges value
   * @param {Number} voucherDiscount - Voucher discount value (optional)
   * @param {Number} couponDiscount - Coupon discount value (optional)
   * @param {Number} firstPurDiscount - First purchase discount value (optional)
   */
  async addOrderTotals(transaction, orderId, finalTotal, courierCharge, voucherDiscount = 0, couponDiscount = 0, firstPurDiscount = 0) {
    // Calculate sub-total (final total minus courier charges)
    const subTotal = finalTotal - courierCharge;
    
    // Create the three required entries
    const orderTotals = [
      {
        order_id: orderId,
        code: 'sub_total',
        title: 'Sub-Total',
        value: subTotal,
        sort_order: 1
      },
      {
        order_id: orderId,
        code: 'courier_charges',
        title: 'Courier Charges',
        value: courierCharge,
        sort_order: 2
      },
      {
        order_id: orderId,
        code: 'total',
        title: 'Total',
        value: finalTotal,
        sort_order: 3
      }
    ];
    
    // Add discount entries if they exist
    if (voucherDiscount > 0) {
      orderTotals.push({
        order_id: orderId,
        code: 'voucher',
        title: 'Voucher Discount',
        value: -voucherDiscount, // Negative value for discounts
        sort_order: 2.1
      });
    }
    
    if (couponDiscount > 0) {
      orderTotals.push({
        order_id: orderId,
        code: 'coupon',
        title: 'Coupon Discount',
        value: -couponDiscount, // Negative value for discounts
        sort_order: 2.2
      });
    }
    
    if (firstPurDiscount > 0) {
      orderTotals.push({
        order_id: orderId,
        code: 'first_purchase',
        title: 'First Purchase Discount',
        value: -firstPurDiscount, // Negative value for discounts
        sort_order: 2.3
      });
    }

    // Use direct SQL query instead of bulkCreate to avoid issues with auto-increment primary key
    const values = orderTotals.map(total => 
      `(${total.order_id},'${total.code}','${total.title}',${total.value},${total.sort_order})`
    ).join(',');
    
    await sequelize.query(
      `INSERT INTO \`oc_order_total\` (\`order_id\`,\`code\`,\`title\`,\`value\`,\`sort_order\`) VALUES ${values}`,
      { type: QueryTypes.INSERT, transaction }
    );
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
    
    // Generate a unique parent_order_id using uuidv4 instead of relying on undefined properties
    const uniqueParentOrderId = uuidv4();
    
    // Insert parent order
    const parentOrder = await ParentOrder.create({
      parent_order_id: uniqueParentOrderId,
      order_ids: orderData.order_ids || '[]', // Use the provided order_ids or default to empty array
      courier_charges: orderData.courier_charges || 0,
      total: orderData.total || 0
    }, { transaction });

    // Update all child orders with parent_order_id reference
    if (orderData.order_ids) {
      try {
        const orderIdsArray = JSON.parse(orderData.order_ids);
        if (Array.isArray(orderIdsArray) && orderIdsArray.length > 0) {
          await Order.update(
            { parent_order_id: uniqueParentOrderId },
            { 
              where: { order_id: { [Op.in]: orderIdsArray } },
              transaction 
            }
          );
        }
      } catch (error) {
        console.error('Error updating orders with parent_order_id:', error);
      }
    }

    return uniqueParentOrderId;
  }

  /**
   * Update order status
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Number} orderStatusId - Order status ID
   * @param {String} comment - Comment (optional)
   */
 async updateOrderStatus(orderId, status, comment = '', transaction = null) {
  const statusMap = {
    'pending': 0,
    'paid': 1,
    'processing': 2,
    'shipped': 3,
    'delivered': 4,
    'cancelled': 7,
    'refunded': 11
  };

  const statusId = statusMap[status] || 0;

  // Pass transaction as option if it exists
  const options = {
    replacements: { orderId, statusId },
    type: QueryTypes.UPDATE,
  };
  if (transaction) options.transaction = transaction;

  // 1. Update main order table
  await sequelize.query(
    `UPDATE oc_order SET 
      order_status_id = :statusId,
      date_modified = NOW()
      WHERE order_id = :orderId`,
    options
  );

  // 2. Add order history entry
  const historyOptions = {
    replacements: { orderId, statusId, comment: comment || `Order status updated to ${status}` },
    type: QueryTypes.INSERT,
  };
  if (transaction) historyOptions.transaction = transaction;

  await sequelize.query(
    `INSERT INTO oc_order_history
      (order_id, order_status_id, notify, comment, date_added)
      VALUES (:orderId, :statusId, 0, :comment, NOW())`,
    historyOptions
  );

  // 3. Update vendor order products table
  const vendorProductOptions = {
    replacements: { orderId, statusId },
    type: QueryTypes.UPDATE,
  };
  if (transaction) vendorProductOptions.transaction = transaction;

  await sequelize.query(
    `UPDATE oc_vendor_order_product SET 
      order_status_id = :statusId,
      date_modified = NOW()
      WHERE order_id = :orderId`,
    vendorProductOptions
  );

  // 4. Add vendor order history entries for each vendor product
  const vendorHistoryOptions = {
    replacements: { orderId, statusId, comment: comment || `Order status updated to ${status}` },
    type: QueryTypes.INSERT,
  };
  if (transaction) vendorHistoryOptions.transaction = transaction;

  await sequelize.query(
    `INSERT INTO oc_order_vendorhistory 
      (order_id, order_status_id, vendor_id, order_product_id, comment, date_added)
    SELECT 
      :orderId,
      :statusId,
      vendor_id,
      order_product_id,
      :comment,
      NOW()
    FROM oc_vendor_order_product
    WHERE order_id = :orderId`,
    vendorHistoryOptions
  );

  console.log(`Updated order status for order ${orderId} to ${status} (${statusId}) in all related tables`);
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
   * Add vendor order products
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Array} products - Order products
   */
  async addVendorOrderProducts(transaction, orderId, products) {
    try {
      // Get all order products for this order to get their order_product_id
      const orderProducts = await sequelize.query(
        'SELECT * FROM oc_order_product WHERE order_id = :orderId',
        {
          replacements: { orderId },
          type: QueryTypes.SELECT,
          transaction
        }
      );

      for (const product of products) {
        // Find the corresponding order_product_id
        const orderProduct = orderProducts.find(op => op.product_id === product.product_id);
        if (!orderProduct) continue;

        // Get vendor_id from oc_vendor_to_product table
        const vendorProduct = await VendorToProduct.findOne({
          where: { product_id: product.product_id },
          transaction
        });

        if (!vendorProduct) {
          console.log(`No vendor found for product_id: ${product.product_id}`);
          continue; // Skip if no vendor is found
        }

        // Create vendor order product record
        await sequelize.query(
          `INSERT INTO oc_vendor_order_product 
          (vendor_id, order_id, order_product_id, product_id, name, model, quantity, price, total, reward, order_status_id, date_added, date_modified) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          {
            replacements: [
              vendorProduct.vendor_id,
              orderId,
              orderProduct.order_product_id,
              product.product_id,
              product.product_data?.name || '',
              product.product_data?.model || '',
              product.quantity,
              product.product_data?.price || 0,
              product.product_data?.price * product.quantity || 0,
              0, // Default value for reward
              0  // Default pending status
            ],
            type: QueryTypes.INSERT,
            transaction
          }
        );
        
        // Add vendor order history record
        await this.addOrderVendorHistory(
          transaction,
          orderId,
          0, // Default pending status
          vendorProduct.vendor_id,
          orderProduct.order_product_id,
          'Order created, awaiting processing'
        );
      }
    } catch (error) {
      console.error('Error adding vendor order products:', error);
      throw error;
    }
  }

  /**
   * Get order by ID with transaction support
   * @param {Number} orderId - Order ID
   * @param {Object} connection - Database connection/transaction
   * @returns {Object} Order data
   */
  async getOrderById(orderId, connection = null) {
    const order = await Order.findByPk(orderId, {
      transaction: connection,
      raw: true
    });
    return order;
  }

  /**
   * Update payment status
   * @param {Number} orderId - Order ID
   * @param {String} status - Payment status
   * @param {Object} connection - Database connection/transaction
   */
  async updatePaymentStatus(orderId, status, connection = null) {
    await sequelize.query(
      `UPDATE oc_order_payment_info SET 
        payment_status = :status,
        date_modified = NOW()
      WHERE order_id = :orderId`,
      {
        replacements: { orderId, status },
        type: QueryTypes.UPDATE,
        transaction: connection
      }
    );
  }

  /**
   * Get order payment info
   * @param {Number} orderId - Order ID
   * @param {Object} connection - Database connection/transaction
   * @returns {Object} Payment info
   */
  async getOrderPaymentInfo(orderId, connection = null) {
    const [paymentInfo] = await sequelize.query(
      'SELECT * FROM oc_order_payment_info WHERE order_id = :orderId',
      {
        replacements: { orderId },
        type: QueryTypes.SELECT,
        transaction: connection
      }
    );
    return paymentInfo;
  }

  /**
   * Update refund status
   * @param {String} paymentId - Payment ID
   * @param {String} status - Refund status
   * @param {Number} amount - Refund amount
   * @param {Object} connection - Database connection/transaction
   */
  async updateRefundStatus(paymentId, status, amount, connection = null) {
    // Create refund table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS oc_order_refunds (
        refund_id INT(11) NOT NULL AUTO_INCREMENT,
        payment_id VARCHAR(128) NOT NULL,
        refund_status VARCHAR(64) NOT NULL,
        refund_amount DECIMAL(15,4) NOT NULL,
        date_added DATETIME NOT NULL,
        date_modified DATETIME NOT NULL,
        PRIMARY KEY (refund_id),
        KEY payment_id (payment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `, { transaction: connection });

    // Insert or update refund record
    await sequelize.query(
      `INSERT INTO oc_order_refunds (
        payment_id, refund_status, refund_amount, date_added, date_modified
      ) VALUES (
        :paymentId, :status, :amount, NOW(), NOW()
      ) ON DUPLICATE KEY UPDATE
        refund_status = :status,
        refund_amount = :amount,
        date_modified = NOW()`,
      {
        replacements: { paymentId, status, amount: amount / 100 },
        type: QueryTypes.INSERT,
        transaction: connection
      }
    );
  }
  
  /**
   * Add order vendor history
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Number} orderStatusId - Order status ID
   * @param {Number} vendorId - Vendor ID
   * @param {Number} orderProductId - Order product ID
   * @param {String} comment - Comment
   */
  async addOrderVendorHistory(transaction, orderId, orderStatusId, vendorId, orderProductId, comment) {
    try {
      await sequelize.query(
        `INSERT INTO oc_order_vendorhistory 
        (order_id, order_status_id, vendor_id, order_product_id, comment, date_added) 
        VALUES (?, ?, ?, ?, ?, NOW())`,
        {
          replacements: [orderId, orderStatusId, vendorId, orderProductId, comment],
          type: QueryTypes.INSERT,
          transaction
        }
      );
    } catch (error) {
      console.error('Error adding order vendor history:', error);
      throw error;
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
  
  /**
   * Add or update order payment information
   * @param {Object} transaction - Database transaction
   * @param {Number} orderId - Order ID
   * @param {Object} paymentInfo - Payment information
   */
  async addOrderPaymentInfo(transaction, orderId, paymentInfo) {
    try {
      // Create order payment info table if it doesn't exist
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS oc_order_payment_info (
          order_payment_info_id INT(11) NOT NULL AUTO_INCREMENT,
          order_id INT(11) NOT NULL,
          payment_provider VARCHAR(64) NOT NULL,
          payment_order_id VARCHAR(128) DEFAULT NULL,
          payment_id VARCHAR(128) DEFAULT NULL,
          payment_status VARCHAR(64) NOT NULL,
          payment_error TEXT DEFAULT NULL,
          date_added DATETIME NOT NULL,
          date_modified DATETIME NOT NULL,
          PRIMARY KEY (order_payment_info_id),
          KEY order_id (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
      `, { transaction });
      
      // Check if payment info already exists for this order
      const [existingInfo] = await sequelize.query(
        'SELECT * FROM oc_order_payment_info WHERE order_id = :orderId',
        {
          replacements: { orderId },
          type: QueryTypes.SELECT,
          transaction
        }
      );
      
      if (existingInfo) {
        // Update existing payment info
        await sequelize.query(
          `UPDATE oc_order_payment_info SET 
            payment_provider = :provider,
            payment_order_id = :orderId,
            payment_id = :paymentId,
            payment_status = :status,
            payment_error = :error,
            date_modified = NOW()
          WHERE order_id = :orderIdParam`,
          {
            replacements: {
              provider: paymentInfo.payment_provider,
              orderId: paymentInfo.payment_order_id || null,
              paymentId: paymentInfo.payment_id || null,
              status: paymentInfo.payment_status,
              error: paymentInfo.payment_error || null,
              orderIdParam: orderId
            },
            type: QueryTypes.UPDATE,
            transaction
          }
        );
      } else {
        // Insert new payment info
        await sequelize.query(
          `INSERT INTO oc_order_payment_info (
            order_id, payment_provider, payment_order_id, payment_id, 
            payment_status, payment_error, date_added, date_modified
          ) VALUES (
            :orderId, :provider, :paymentOrderId, :paymentId, 
            :status, :error, NOW(), NOW()
          )`,
          {
            replacements: {
              orderId,
              provider: paymentInfo.payment_provider,
              paymentOrderId: paymentInfo.payment_order_id || null,
              paymentId: paymentInfo.payment_id || null,
              status: paymentInfo.payment_status,
              error: paymentInfo.payment_error || null
            },
            type: QueryTypes.INSERT,
            transaction
          }
        );
      }
      
      // Add entry to order history
      await this.updateOrderStatus(
        transaction,
        orderId,
        paymentInfo.payment_status === 'completed' ? 1 : 0, // 1 = Processing, 0 = Pending
        `Payment ${paymentInfo.payment_status} via ${paymentInfo.payment_provider}`
      );
      
      return true;
    } catch (error) {
      console.error('Error adding order payment info:', error);
      throw error;
    }
  }
}

module.exports = new OrderModel();