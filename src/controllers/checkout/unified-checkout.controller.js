/**
 * Unified Checkout Controller
 * Handles the entire checkout process in a single request
 */

const db = require('../../../config/database');
const redis = require('../../../config/redis');
const { validationResult } = require('express-validator');

/**
 * Process a complete checkout in a single request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.processCheckout = async (req, res) => {
  // Validate request data
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Extract checkout data from request
  const {
    customer_id,
    shipping_address,
    payment_method,
    comment,
    agree_terms,
    cart_items
  } = req.body;

  // Start database transaction
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Validate customer exists and get default address
    const [customerResult] = await connection.query(
      'SELECT * FROM customer WHERE customer_id = ?',
      [customer_id]
    );
    
    if (!customerResult.length) {
      throw new Error('Customer not found');
    }
    
    const customer = customerResult[0];
    
    // Get customer's default address
    const [addressResult] = await connection.query(
      'SELECT * FROM address WHERE address_id = ?',
      [customer.address_id]
    );
    
    if (!addressResult.length) {
      throw new Error('Default address not found for customer');
    }
    
    const payment_address = addressResult[0];

    // 2. Validate cart items and check stock
    const validatedItems = await validateCartItems(connection, cart_items);
    if (!validatedItems.success) {
      throw new Error(validatedItems.message);
    }

    // 3. Create parent order for split orders
    const parentOrderId = await createParentOrder(connection, customer_id);

    // 4. Process each product as a separate order
    const orderIds = [];
    for (const item of validatedItems.items) {
      // Create single item array for this product
      const singleItemArray = [item];
      
      // Calculate totals for this product
      const totals = calculateOrderTotals(singleItemArray, shipping_method);
      
      // Create order for this product
      const orderId = await createOrder(
        connection,
        {
          customer_id,
          payment_address,
          shipping_address,
          shipping_method,
          payment_method: { code: 'cod', title: 'Cash On Delivery' }, // Default payment method
          comment,
          items: singleItemArray,
          totals,
          parent_order_id: parentOrderId,
          product_id: item.product_id
        }
      );
      
      orderIds.push(orderId);
      
      // Update product stock
      await updateProductStock(connection, singleItemArray);
    }

    // 6. Process payment
    const paymentResult = await processPayment(
      connection,
      payment_method,
      orderIds,
      req.body
    );

    if (!paymentResult.success) {
      throw new Error(paymentResult.message);
    }

    // 7. Clear cart after successful checkout
    await clearCart(customer_id);

    // Commit transaction
    await connection.commit();
    
    // Return success response with order IDs and payment info
    return res.status(200).json({
      success: true,
      order_ids: orderIds,
      parent_order_id: parentOrderId,
      payment_info: paymentResult.data
    });
    
  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during checkout'
    });
  } finally {
    connection.release();
  }
};

/**
 * Validate cart items and check stock
 * @param {Object} connection - Database connection
 * @param {Array} items - Cart items
 * @returns {Object} Validation result
 */
async function validateCartItems(connection, items) {
  try {
    const validatedItems = [];
    
    for (const item of items) {
      // Check if product exists
      const [product] = await connection.query(
        'SELECT * FROM product WHERE product_id = ? AND status = 1',
        [item.product_id]
      );
      
      if (!product.length) {
        return {
          success: false,
          message: `Product ID ${item.product_id} not found or unavailable`
        };
      }
      
      // Check stock
      if (product[0].quantity < item.quantity) {
        return {
          success: false,
          message: `Insufficient stock for product ID ${item.product_id}. Available: ${product[0].quantity}`
        };
      }
      
      // Check minimum quantity
      if (product[0].minimum > item.quantity) {
        return {
          success: false,
          message: `Minimum quantity for product ID ${item.product_id} is ${product[0].minimum}`
        };
      }
      
      // Get product options if any
      if (item.option && item.option.length > 0) {
        const options = await getProductOptions(connection, item.product_id, item.option);
        item.options = options;
      }
      
      // Add product data to validated items
      validatedItems.push({
        ...item,
        product_data: product[0]
      });
    }
    
    return {
      success: true,
      items: validatedItems
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Error validating cart items'
    };
  }
}

/**
 * Get product options
 * @param {Object} connection - Database connection
 * @param {number} productId - Product ID
 * @param {Array} options - Selected options
 * @returns {Array} Product options
 */
async function getProductOptions(connection, productId, options) {
  const productOptions = [];
  
  for (const option of options) {
    const [optionData] = await connection.query(
      `SELECT * FROM product_option_value pov
       JOIN option_value ov ON pov.option_value_id = ov.option_value_id
       JOIN \`option\` o ON ov.option_id = o.option_id
       WHERE pov.product_id = ? AND pov.product_option_value_id = ?`,
      [productId, option.product_option_value_id]
    );
    
    if (optionData.length) {
      productOptions.push({
        product_option_id: optionData[0].product_option_id,
        product_option_value_id: optionData[0].product_option_value_id,
        option_id: optionData[0].option_id,
        option_value_id: optionData[0].option_value_id,
        name: optionData[0].name,
        value: optionData[0].value,
        price: optionData[0].price,
        price_prefix: optionData[0].price_prefix
      });
    }
  }
  
  return productOptions;
}

/**
 * Group products by vendor
 * @param {Array} items - Cart items
 * @returns {Object} Products grouped by vendor
 */
function groupProductsByVendor(items) {
  const vendorGroups = {};
  
  for (const item of items) {
    const vendorId = item.product_data.vendor_id || 0;
    
    if (!vendorGroups[vendorId]) {
      vendorGroups[vendorId] = [];
    }
    
    vendorGroups[vendorId].push(item);
  }
  
  return vendorGroups;
}

/**
 * Calculate order totals
 * @param {Array} items - Order items
 * @param {Object} shippingMethod - Shipping method
 * @returns {Array} Order totals
 */
function calculateOrderTotals(items, shippingMethod) {
  const totals = [];
  let subtotal = 0;
  
  // Calculate subtotal
  for (const item of items) {
    const itemPrice = parseFloat(item.product_data.price);
    const itemTotal = itemPrice * item.quantity;
    subtotal += itemTotal;
    
    // Add option prices if any
    if (item.options && item.options.length > 0) {
      for (const option of item.options) {
        if (option.price_prefix === '+') {
          subtotal += parseFloat(option.price);
        } else if (option.price_prefix === '-') {
          subtotal -= parseFloat(option.price);
        }
      }
    }
  }
  
  totals.push({
    code: 'sub_total',
    title: 'Sub-Total',
    value: subtotal,
    sort_order: 1
  });
  
  // Add shipping cost
  if (shippingMethod && shippingMethod.cost) {
    totals.push({
      code: 'shipping',
      title: `Shipping (${shippingMethod.title})`,
      value: parseFloat(shippingMethod.cost),
      sort_order: 3
    });
  }
  
  // Calculate tax (simplified - in real implementation, tax would be calculated based on tax rules)
  const taxRate = 0.18; // 18% GST (example)
  const taxAmount = subtotal * taxRate;
  
  totals.push({
    code: 'tax',
    title: 'GST (18%)',
    value: taxAmount,
    sort_order: 5
  });
  
  // Calculate total
  const total = subtotal + (shippingMethod?.cost || 0) + taxAmount;
  
  totals.push({
    code: 'total',
    title: 'Total',
    value: total,
    sort_order: 9
  });
  
  return totals;
}

/**
 * Create parent order for split orders
 * @param {Object} connection - Database connection
 * @param {number} customerId - Customer ID
 * @returns {number} Parent order ID
 */
async function createParentOrder(connection, customerId) {
  const [result] = await connection.query(
    'INSERT INTO order_parent (customer_id, date_added) VALUES (?, NOW())',
    [customerId]
  );
  
  return result.insertId;
}

/**
 * Create an order
 * @param {Object} connection - Database connection
 * @param {Object} orderData - Order data
 * @returns {number} Order ID
 */
async function createOrder(connection, orderData) {
  // Get total amount
  const totalItem = orderData.totals.find(item => item.code === 'total');
  const totalAmount = totalItem ? totalItem.value : 0;
  
  // Insert order
  const [orderResult] = await connection.query(
    `INSERT INTO \`order\` (
      customer_id, 
      payment_firstname, 
      payment_lastname, 
      payment_company, 
      payment_address_1, 
      payment_address_2, 
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
      shipping_company, 
      shipping_address_1, 
      shipping_address_2, 
      shipping_city, 
      shipping_postcode, 
      shipping_country, 
      shipping_country_id, 
      shipping_zone, 
      shipping_zone_id, 
      shipping_method, 
      shipping_code, 
      comment, 
      total, 
      order_status_id, 
      parent_order_id, 
      vendor_id, 
      date_added, 
      date_modified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      orderData.customer_id,
      orderData.payment_address.firstname,
      orderData.payment_address.lastname,
      orderData.payment_address.company || '',
      orderData.payment_address.address_1,
      orderData.payment_address.address_2 || '',
      orderData.payment_address.city,
      orderData.payment_address.postcode,
      orderData.payment_address.country,
      orderData.payment_address.country_id,
      orderData.payment_address.zone,
      orderData.payment_address.zone_id,
      orderData.payment_method.title,
      orderData.payment_method.code,
      orderData.shipping_address.firstname,
      orderData.shipping_address.lastname,
      orderData.shipping_address.company || '',
      orderData.shipping_address.address_1,
      orderData.shipping_address.address_2 || '',
      orderData.shipping_address.city,
      orderData.shipping_address.postcode,
      orderData.shipping_address.country,
      orderData.shipping_address.country_id,
      orderData.shipping_address.zone,
      orderData.shipping_address.zone_id,
      orderData.shipping_method.title,
      orderData.shipping_method.code,
      orderData.comment || '',
      totalAmount,
      1, // Default order status (Pending)
      orderData.parent_order_id,
      orderData.vendor_id,
    ]
  );
  
  const orderId = orderResult.insertId;
  
  // Insert order products
  for (const item of orderData.items) {
    await connection.query(
      `INSERT INTO order_product (
        order_id, 
        product_id, 
        name, 
        model, 
        quantity, 
        price, 
        total, 
        tax
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        item.product_id,
        item.product_data.name,
        item.product_data.model,
        item.quantity,
        item.product_data.price,
        item.product_data.price * item.quantity,
        0 // Tax will be calculated separately
      ]
    );
    
    // Insert order options if any
    if (item.options && item.options.length > 0) {
      for (const option of item.options) {
        await connection.query(
          `INSERT INTO order_option (
            order_id, 
            order_product_id, 
            product_option_id, 
            product_option_value_id, 
            name, 
            value, 
            type
          ) VALUES (?, LAST_INSERT_ID(), ?, ?, ?, ?, ?)`,
          [
            orderId,
            option.product_option_id,
            option.product_option_value_id,
            option.name,
            option.value,
            'select' // Default type
          ]
        );
      }
    }
  }
  
  // Insert order totals
  for (const total of orderData.totals) {
    await connection.query(
      `INSERT INTO order_total (
        order_id, 
        code, 
        title, 
        value, 
        sort_order
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        orderId,
        total.code,
        total.title,
        total.value,
        total.sort_order
      ]
    );
  }
  
  return orderId;
}

/**
 * Update product stock
 * @param {Object} connection - Database connection
 * @param {Array} items - Order items
 */
async function updateProductStock(connection, items) {
  for (const item of items) {
    await connection.query(
      'UPDATE product SET quantity = quantity - ? WHERE product_id = ?',
      [item.quantity, item.product_id]
    );
  }
}

/**
 * Process payment
 * @param {Object} connection - Database connection
 * @param {Object} paymentMethod - Payment method
 * @param {Array} orderIds - Order IDs
 * @param {Object} requestData - Request data
 * @returns {Object} Payment result
 */
async function processPayment(connection, paymentMethod, orderIds, requestData) {
  try {
    switch (paymentMethod.code) {
      case 'cod':
        // For COD, just update order status
        for (const orderId of orderIds) {
          await connection.query(
            'UPDATE `order` SET order_status_id = ? WHERE order_id = ?',
            [1, orderId] // Status 1: Pending
          );
        }
        
        return {
          success: true,
          data: {
            method: 'cod',
            status: 'pending'
          }
        };
        
      case 'razorpay':
        // For Razorpay, create payment order
        // In a real implementation, this would integrate with Razorpay API
        const razorpayOrderId = 'rzp_' + Date.now();
        
        // Store Razorpay order ID in order history
        for (const orderId of orderIds) {
          await connection.query(
            `INSERT INTO order_history (
              order_id, 
              order_status_id, 
              notify, 
              comment, 
              date_added
            ) VALUES (?, ?, ?, ?, NOW())`,
            [
              orderId,
              1, // Status 1: Pending
              0, // Don't notify customer
              `Razorpay Order ID: ${razorpayOrderId}`,
            ]
          );
        }
        
        return {
          success: true,
          data: {
            method: 'razorpay',
            order_id: razorpayOrderId,
            amount: requestData.amount,
            currency: 'INR',
            status: 'created'
          }
        };
        
      default:
        return {
          success: false,
          message: `Payment method ${paymentMethod.code} not supported`
        };
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Error processing payment'
    };
  }
}

/**
 * Clear customer cart
 * @param {number} customerId - Customer ID
 */
async function clearCart(customerId) {
  try {
    // Clear cart from Redis
    await redis.del(`cart:${customerId}`);
    
    // Clear cart from database
    const connection = await db.getConnection();
    try {
      await connection.query(
        'DELETE FROM cart WHERE customer_id = ?',
        [customerId]
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error clearing cart:', error);
    // Don't throw error as this is not critical
  }
}