/**
 * Unified Checkout Controller
 * Handles the entire checkout process in a single request
 */

const db = require('../../../config/database');
// Create a connection variable that references db.connection for backward compatibility
const connection = db.connection;
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

  console.log('Starting unified checkout process');
  console.log('Request body data:', JSON.stringify(req.body, null, 2));

  // Extract checkout data from request
  const {
    shipping_address_id,
    payment_method,
    shipping_method,
    comment,
    agree_terms,
    alternate_mobile_number,
    'gst-no': gstNo
  } = req.body;
  
  // Get customer_id from authenticated user
  const customer_id = req.user.id;
  
  // Validate required fields
  const requiredFields = ['shipping_address_id', 'payment_method', 'agree_terms'];
  const missingFields = requiredFields.filter(field => !req.body[field]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`
    });
  }
  
  // Validate agreement to terms
  if (!agree_terms) {
    return res.status(400).json({
      success: false,
      message: 'You must agree to the terms and conditions'
    });
  }

  // Start database transaction
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Validate authentication
    if (!req.user || !req.user.customer_id || req.user.customer_id != customer_id) {
      throw new Error('Authentication failed. Please login again.');
    }

    // 2. Get customer's default address for payment
    const [customerResult] = await connection.query(
      'SELECT * FROM customer WHERE customer_id = ?',
      [customer_id]
    );
    
    if (!customerResult.length) {
      throw new Error('Customer not found');
    }
    
    const customer = customerResult[0];
    
    // Get customer's default address as payment address
    const [addressResult] = await connection.query(
      'SELECT * FROM address WHERE address_id = ?',
      [customer.address_id]
    );
    
    if (!addressResult.length) {
      throw new Error('Default address not found for customer');
    }
    
    const payment_address = addressResult[0];

    // 3. Get shipping address from shipping_address_id
    const [shippingAddressResult] = await connection.query(
      'SELECT * FROM address WHERE address_id = ?',
      [shipping_address_id]
    );
    
    if (!shippingAddressResult.length) {
      throw new Error('Shipping address not found');
    }
    
    const shipping_address = shippingAddressResult[0];

    // 2. Get cart items from the customer's cart
    const [cartItems] = await connection.query(
      `SELECT ci.*, p.minimum, p.no_shipping 
       FROM cart_item ci 
       JOIN product p ON ci.product_id = p.product_id 
       WHERE ci.customer_id = ?`,
      [customer_id]
    );
    
    if (!cartItems.length) {
      throw new Error('Cart is empty');
    }
    
    // Use all items in the customer's cart
    const selectedCartItems = cartItems;
    
    // Validate payment method for no-shipping products
    const hasNoShippingProduct = selectedCartItems.some(item => item.no_shipping === true);
    if (hasNoShippingProduct && payment_method.code !== 'razorpay') {
      throw new Error('Products with no shipping option require Razorpay payment method');
    }
    
    // Validate cart items and check stock
    const validatedItems = await validateCartItems(connection, selectedCartItems);
    if (!validatedItems.success) {
      throw new Error(validatedItems.message);
    }

    // 3. Create parent order for split orders
    const parentOrderData = {
      customer_id: customer_id,
      payment_method: payment_method.title || '',
      payment_code: payment_method.code || '',
      shipping_method: shipping_method?.title || '',
      shipping_code: shipping_method?.code || '',
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      voucher_code: req.body.voucher_code || null,
      referral_code: req.body.referral_code || null
    };
    
    const parentOrderId = await createParentOrder(connection, customer_id, parentOrderData);

    // 4. Process each product as a separate order
    const orderIds = [];
    for (const item of validatedItems.items) {
      // Create single item array for this product
      const singleItemArray = [item];
      
      // Calculate totals for this product with shipping method and voucher/referral codes
      const shippingMethodWithCodes = {
        ...shipping_method,
        voucher_code: req.body.voucher_code || null,
        referral_code: req.body.referral_code || null
      };
      
      const totals = calculateOrderTotals(singleItemArray, shippingMethodWithCodes);
      
      // Create order for this product
      const orderId = await createOrder(
        connection,
        {
          customer_id,
          payment_address,
          shipping_address,
          payment_method, // Use actual payment method from request
          shipping_method, // Pass shipping method to order
          comment,
          items: singleItemArray,
          totals,
          parent_order_id: parentOrderId,
          product_id: item.product_id,
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          voucher_code: req.body.voucher_code || null,
          referral_code: req.body.referral_code || null
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
    
    // Return appropriate response based on payment method
    if (payment_method.code === 'cod') {
      // For COD, return order success response
      return res.status(200).json({
        success: true,
        order_success: true,
        message: 'Order placed successfully',
        order_ids: orderIds,
        parent_order_id: parentOrderId,
        payment_info: paymentResult.data
      });
    } else {
      // For online payments, return payment initiation response
      return res.status(200).json({
        success: true,
        order_success: false,
        message: 'Payment process initiated',
        order_ids: orderIds,
        parent_order_id: parentOrderId,
        payment_info: paymentResult.data
      });
    }
    
  } catch (error) {
    // Rollback transaction on error
    console.log('ERROR in unified checkout process:', error.message);
    console.log('Rolling back transaction due to error');
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
 * @param {Array} items - Cart items
 * @param {Object} shippingMethod - Shipping method (optional)
 * @returns {Array} Order totals
 */
function calculateOrderTotals(items, shippingMethod = null) {
  const totals = [];
  let subtotal = 0;
  
  // Calculate product subtotal
  for (const item of items) {
    const itemPrice = parseFloat(item.product_data.price);
    const quantity = parseInt(item.quantity);
    subtotal += itemPrice * quantity;
  }
  
  totals.push({
    code: 'sub_total',
    title: 'Sub-Total',
    value: subtotal,
    sort_order: 1
  });
  
  // Add voucher discount if provided
  if (shippingMethod && shippingMethod.voucher_code) {
    // In a real implementation, we would query the voucher from database
    // and calculate the discount based on voucher type
    const discountAmount = subtotal * 0.1; // Example: 10% discount
    
    totals.push({
      code: 'voucher',
      title: `Voucher (${shippingMethod.voucher_code})`,
      value: -discountAmount, // Negative value for discount
      sort_order: 2
    });
    
    // Adjust subtotal for tax calculation
    subtotal -= discountAmount;
  }
  
  // Add shipping cost
  if (shippingMethod && shippingMethod.cost) {
    totals.push({
      code: 'shipping',
      title: `Shipping (${shippingMethod.title})`,
      value: parseFloat(shippingMethod.cost),
      sort_order: 3
    });
  }
  
  // Add referral discount if provided
  if (shippingMethod && shippingMethod.referral_code) {
    // In a real implementation, we would validate the referral code
    // and calculate the discount based on referral program rules
    const referralDiscount = subtotal * 0.05; // Example: 5% discount
    
    totals.push({
      code: 'referral',
      title: `Referral Discount (${shippingMethod.referral_code})`,
      value: -referralDiscount, // Negative value for discount
      sort_order: 4
    });
    
    // Adjust subtotal for tax calculation
    subtotal -= referralDiscount;
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
  const total = subtotal + taxAmount;
  
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
 * @param {Object} orderData - Order data for additional fields
 * @returns {number} Parent order ID
 */
async function createParentOrder(connection, customerId, orderData) {
  // Get customer data
  const [customerResult] = await connection.query(
    'SELECT * FROM customer WHERE customer_id = ?',
    [customerId]
  );
  
  if (!customerResult.length) {
    throw new Error('Customer not found');
  }
  
  const customer = customerResult[0];
  
  // Calculate total amount from all child orders (will be updated after child orders are created)
  const parentTotalAmount = 0;
  
  // Generate invoice prefix
  const invoicePrefix = 'INV-PARENT-' + new Date().getFullYear() + '-';
  
  // Get store information
  const storeId = 0; // Default store
  const storeName = 'Default Store';
  const storeUrl = process.env.STORE_URL || 'http://localhost:3000';
  
  // Insert parent order with extended data
  const [result] = await connection.query(
    `INSERT INTO order_parent (
      customer_id,
      customer_group_id,
      firstname,
      lastname,
      email,
      telephone,
      payment_method,
      payment_code,
      shipping_method,
      shipping_code,
      store_id,
      store_name,
      store_url,
      total,
      invoice_prefix,
      date_added,
      ip,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
    [
      customerId,
      customer.customer_group_id,
      customer.firstname,
      customer.lastname,
      customer.email,
      customer.telephone,
      orderData.payment_method,
      orderData.payment_code || '',
      orderData.shipping_method,
      orderData.shipping_code || '',
      storeId,
      storeName,
      storeUrl,
      parentTotalAmount,
      invoicePrefix,
      orderData.ip || '127.0.0.1',
      orderData.user_agent || 'API Client'
    ]
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
  // Get customer data
  const [customerResult] = await connection.query(
    'SELECT * FROM customer WHERE customer_id = ?',
    [orderData.customer_id]
  );
  
  if (!customerResult.length) {
    throw new Error('Customer not found');
  }
  
  const customer = customerResult[0];
  
  // Get total amount from order totals
  const totalItem = orderData.totals.find(item => item.code === 'total');
  const totalAmount = totalItem ? totalItem.value : 0;
  
  // Get courier charges
  const courierItem = orderData.totals.find(item => item.code === 'shipping');
  const courierCharges = courierItem ? courierItem.value : 0;
  
  // Generate invoice prefix
  const invoicePrefix = 'INV-' + new Date().getFullYear() + '-';
  
  // Get store information
  const storeId = 0; // Default store
  const storeName = 'Default Store';
  const storeUrl = process.env.STORE_URL || 'http://localhost:3000';
  
  // Insert order
  const [orderResult] = await connection.query(
    `INSERT INTO \`order\` (
      invoice_prefix,
      store_id,
      store_name,
      store_url,
      customer_id, 
      customer_group_id,
      firstname,
      lastname,
      email,
      telephone,
      custom_field,
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
      payment_telephone,
      payment_address_format,
      payment_custom_field,
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
      shipping_telephone,
      shipping_address_format,
      shipping_custom_field,
      shipping_method, 
      shipping_code, 
      comment,
      total_courier_charges,
      total, 
      order_status_id, 
      parent_order_id, 
      vendor_id,
      language_id,
      currency_id,
      currency_code,
      currency_value,
      ip,
      forwarded_ip,
      user_agent,
      accept_language,
      date_added, 
      date_modified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      invoicePrefix,
      storeId,
      storeName,
      storeUrl,
      orderData.customer_id,
      customer.customer_group_id || 1,
      customer.firstname,
      customer.lastname,
      customer.email,
      customer.telephone,
      JSON.stringify(customer.custom_field || {}),
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
      orderData.payment_address.telephone || customer.telephone,
      orderData.payment_address.address_format || '',
      JSON.stringify(orderData.payment_address.custom_field || {}),
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
      orderData.shipping_address.telephone || customer.telephone,
      orderData.shipping_address.address_format || '',
      JSON.stringify(orderData.shipping_address.custom_field || {}),
      orderData.shipping_method?.title || '',
      orderData.shipping_method?.code || '',
      orderData.comment || '',
      courierCharges,
      totalAmount,
      1, // Default order status (Pending)
      orderData.parent_order_id,
      orderData.vendor_id || 0,
      1, // Default language ID
      1, // Default currency ID
      'INR', // Default currency code
      1.0, // Default currency value
      orderData.ip || '127.0.0.1',
      orderData.forwarded_ip || '',
      orderData.user_agent || '',
      orderData.accept_language || 'en-US,en;q=0.9',
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
  }
  
  // Insert order totals with detailed breakdown
  const subtotalItem = orderData.totals.find(item => item.code === 'sub_total');
  const subtotal = subtotalItem ? subtotalItem.value : 0;
  
  // Insert sub_total
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
      'sub_total',
      'Sub-Total',
      subtotal,
      1
    ]
  );
  
  // Insert shipping if applicable
  const shippingItem = orderData.totals.find(item => item.code === 'shipping');
  if (shippingItem) {
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
        'shipping',
        shippingItem.title,
        shippingItem.value,
        2
      ]
    );
  }
  
  // Insert tax
  const taxItem = orderData.totals.find(item => item.code === 'tax');
  if (taxItem) {
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
        'tax',
        taxItem.title,
        taxItem.value,
        3
      ]
    );
  }
  
  // Insert total
  const orderTotalItem = orderData.totals.find(item => item.code === 'total');
  const orderTotalAmount = orderTotalItem ? orderTotalItem.value : 0;
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
      'total',
      'Total',
      orderTotalAmount,
      9
    ]
  );
  
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
        // For COD, set order status to Processing (2)
        for (const orderId of orderIds) {
          await connection.query(
            'UPDATE `order` SET order_status_id = ? WHERE order_id = ?',
            [2, orderId] // Status 2: Processing
          );
        }
        
        return {
          success: true,
          data: {
            method: 'cod',
            status: 'processing',
            order_confirmed: true
          }
        };
        
      case 'razorpay':
        // For Razorpay, create payment order
        // In a real implementation, this would integrate with Razorpay API
        const razorpayOrderId = 'rzp_' + Date.now();
        
        // Set order status to Awaiting Payment (0)
        for (const orderId of orderIds) {
          await connection.query(
            'UPDATE `order` SET order_status_id = ? WHERE order_id = ?',
            [0, orderId] // Status 0: Awaiting Payment
          );
          
          // Store Razorpay order ID in order history
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
              0, // Status 0: Awaiting Payment
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
            status: 'awaiting_payment',
            order_confirmed: false
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