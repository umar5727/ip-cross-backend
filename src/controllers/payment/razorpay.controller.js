/**
 * Razorpay Payment Controller
 * Handles Razorpay payment operations for split orders
 */

const db = require('../../../config/database');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('Razorpay credentials not found in environment variables');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create Razorpay order for parent order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    // Check if Razorpay credentials are available
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay credentials not configured'
      });
    }

    const { parent_order_id, amount, currency = 'INR', notes = {} } = req.body;

    // Validate required fields
    if (!parent_order_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Parent order ID and amount are required'
      });
    }

    // Get parent order details
    const connection = await db.getConnection();
    const [parentOrder] = await connection.query(
      'SELECT * FROM oc_order_parent WHERE parent_order_id = ?',
      [parent_order_id]
    );

    if (!parentOrder.length) {
      return res.status(404).json({
        success: false,
        message: 'Parent order not found'
      });
    }

    const parentOrderData = parentOrder[0];

    // Convert amount to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: currency,
      receipt: `receipt_${parent_order_id}_${Date.now()}`,
      notes: {
        parent_order_id: parent_order_id,
        order_ids: parentOrderData.order_ids,
        ...notes
      }
    });

    // Store Razorpay transaction record
    await connection.query(
      `INSERT INTO oc_razorpay_transaction (
        razorpay_payment_id, razorpay_order_id, razorpay_signature, 
        merchant_order_id, parent_order_id, is_parent_order, 
        amount, currency, status, date_added, order_ids_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        '', // razorpay_payment_id - empty initially
        razorpayOrder.id, // razorpay_order_id
        '', // razorpay_signature - empty initially
        0, // merchant_order_id - 0 for parent orders
        parent_order_id, // parent_order_id
        1, // is_parent_order - true for parent orders
        amount, // amount
        currency, // currency
        'created', // status
        parentOrderData.order_ids // order_ids_json
      ]
    );

    connection.release();

    res.status(200).json({
      success: true,
      data: {
        razorpay_order_id: razorpayOrder.id,
        amount: amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        key_id: process.env.RAZORPAY_KEY_ID,
        parent_order_id: parent_order_id
      }
    });

  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message
    });
  }
};

/**
 * Verify payment signature
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      parent_order_id
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order ID, payment ID, and signature are required'
      });
    }

    // Verify payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Update Razorpay transaction record
    const connection = await db.getConnection();
    await connection.query(
      `UPDATE oc_razorpay_transaction 
       SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'captured'
       WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    // Get parent order details
    const [parentOrder] = await connection.query(
      'SELECT * FROM oc_order_parent WHERE parent_order_id = ?',
      [parent_order_id]
    );

    if (parentOrder.length > 0) {
      const orderIds = JSON.parse(parentOrder[0].order_ids);
      
      // Update all child orders status to processing
      for (const orderId of orderIds) {
        await connection.query(
          'UPDATE `order` SET order_status_id = 2 WHERE order_id = ?',
          [orderId]
        );
        
        // Add order history
        await connection.query(
          `INSERT INTO order_history (order_id, order_status_id, notify, comment, date_added)
           VALUES (?, 2, 0, 'Payment verified successfully', NOW())`,
          [orderId]
        );
      }
    }

    connection.release();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        payment_id: razorpay_payment_id,
        parent_order_id: parent_order_id,
        status: 'captured'
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

/**
 * Get payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { parent_order_id } = req.params;

    const connection = await db.getConnection();
    const [paymentRecord] = await connection.query(
      `SELECT rt.*, op.total, op.courier_charges, op.order_ids
       FROM oc_razorpay_transaction rt
       LEFT JOIN oc_order_parent op ON rt.parent_order_id = op.parent_order_id
       WHERE rt.parent_order_id = ?`,
      [parent_order_id]
    );

    connection.release();

    if (!paymentRecord.length) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    const payment = paymentRecord[0];
    
    res.status(200).json({
      success: true,
      data: {
        parent_order_id: payment.parent_order_id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        order_ids: payment.order_ids ? JSON.parse(payment.order_ids) : [],
        total: payment.total,
        courier_charges: payment.courier_charges,
        date_added: payment.date_added
      }
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message
    });
  }
};

/**
 * Process refund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.processRefund = async (req, res) => {
  try {
    const { parent_order_id, amount, notes = {} } = req.body;

    if (!parent_order_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Parent order ID and amount are required'
      });
    }

    // Get payment record
    const connection = await db.getConnection();
    const [paymentRecord] = await connection.query(
      'SELECT * FROM oc_razorpay_transaction WHERE parent_order_id = ? AND status = "captured"',
      [parent_order_id]
    );

    if (!paymentRecord.length) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found or not captured'
      });
    }

    const payment = paymentRecord[0];

    // Convert amount to paise
    const amountInPaise = Math.round(amount * 100);

    // Process refund with Razorpay
    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
      amount: amountInPaise,
      notes: {
        parent_order_id: parent_order_id,
        ...notes
      }
    });

    // Update payment record
    await connection.query(
      `UPDATE oc_razorpay_transaction 
       SET status = 'refunded' 
       WHERE parent_order_id = ?`,
      [parent_order_id]
    );

    // Update child orders status
    const [parentOrder] = await connection.query(
      'SELECT order_ids FROM oc_order_parent WHERE parent_order_id = ?',
      [parent_order_id]
    );

    if (parentOrder.length > 0) {
      const orderIds = JSON.parse(parentOrder[0].order_ids);
      
      for (const orderId of orderIds) {
        await connection.query(
          'UPDATE `order` SET order_status_id = 5 WHERE order_id = ?',
          [orderId]
        );
        
        // Add order history
        await connection.query(
          `INSERT INTO order_history (order_id, order_status_id, notify, comment, date_added)
           VALUES (?, 5, 0, 'Refund processed', NOW())`,
          [orderId]
        );
      }
    }

    connection.release();

    res.status(200).json({
      success: true,
      data: {
        refund_id: refund.id,
        amount: amount,
        status: refund.status,
        parent_order_id: parent_order_id
      }
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
};

/**
 * Handle Razorpay webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = req.body;

    // Handle payment captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      
      // Update payment record
      const connection = await db.getConnection();
      await connection.query(
        `UPDATE oc_razorpay_transaction 
         SET razorpay_payment_id = ?, status = 'captured'
         WHERE razorpay_order_id = ?`,
        [payment.id, payment.order_id]
      );

      // Get parent order and update child orders
      const [parentOrder] = await connection.query(
        'SELECT parent_order_id, order_ids FROM oc_razorpay_transaction WHERE razorpay_order_id = ?',
        [payment.order_id]
      );

      if (parentOrder.length > 0) {
        const orderIds = JSON.parse(parentOrder[0].order_ids);
        
        for (const orderId of orderIds) {
          await connection.query(
            'UPDATE `order` SET order_status_id = 2 WHERE order_id = ?',
            [orderId]
          );
        }
      }

      connection.release();
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook handling failed',
      error: error.message
    });
  }
};
