/**
 * Razorpay Payment Controller
 * Handles Razorpay payment integration
 */

const crypto = require('crypto');
const db = require('../../../config/database');
const orderModel = require('../../models/checkout/order.model');

// Initialize Razorpay
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (err) {
  console.error('Razorpay package not found. Please install it using: npm install razorpay');
}

// Create Razorpay instance
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!key_id || !key_secret) {
    throw new Error('Razorpay API keys not configured');
  }
  
  return new Razorpay({
    key_id: key_id,
    key_secret: key_secret
  });
};

/**
 * Create a Razorpay order
 */
exports.createOrder = async (req, res) => {
  try {
    const { order_id, amount } = req.body;
    
    if (!order_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and amount are required'
      });
    }
    
    // Get order details from database to verify
    const orderDetails = await orderModel.getOrder(order_id);
    if (!orderDetails) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Verify amount matches order total
    if (parseFloat(orderDetails.total) !== parseFloat(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Amount mismatch with order total'
      });
    }
    
    const instance = getRazorpayInstance();
    
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt: `receipt_${order_id}`,
      notes: {
        order_id: order_id,
        customer_id: orderDetails.customer_id
      }
    };
    
    const razorpayOrder = await instance.orders.create(options);
    
    // Store Razorpay order ID in database
    const transaction = await db.transaction();
    try {
      await orderModel.addOrderPaymentInfo(transaction, order_id, {
        payment_provider: 'razorpay',
        payment_order_id: razorpayOrder.id,
        payment_status: 'pending'
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
    res.status(200).json({
      success: true,
      order: razorpayOrder,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
};

/**
 * Verify Razorpay payment
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      order_id 
    } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters'
      });
    }
    
    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');
    
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }
    
    // Update order status in database
    const transaction = await db.transaction();
    try {
      // Update order status to processing (paid)
      await orderModel.updateOrderStatus(
        transaction,
        order_id,
        1, // Processing status
        'Payment successful via Razorpay'
      );
      
      // Update payment info
      await orderModel.addOrderPaymentInfo(transaction, order_id, {
        payment_provider: 'razorpay',
        payment_order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        payment_status: 'completed'
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: "Payment verified successfully"
    });
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

/**
 * Handle Razorpay webhooks
 */
exports.webhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    if (!webhookSecret || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing webhook signature or secret'
      });
    }
    
    // Verify webhook signature
    const shasum = crypto.createHmac('sha256', webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');
    
    if (digest !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }
    
    // Process webhook event
    const event = req.body.event;
    
    if (event === 'payment.authorized' || event === 'payment.captured') {
      // Handle payment success
      const payment = req.body.payload.payment.entity;
      const orderId = payment.notes.order_id;
      
      const transaction = await db.transaction();
      try {
        // Update order status to processing (paid)
        await orderModel.updateOrderStatus(
          transaction,
          orderId,
          1, // Processing status
          `Payment ${event === 'payment.captured' ? 'captured' : 'authorized'} via Razorpay webhook`
        );
        
        // Update payment info
        await orderModel.addOrderPaymentInfo(transaction, orderId, {
          payment_provider: 'razorpay',
          payment_order_id: payment.order_id,
          payment_id: payment.id,
          payment_status: event === 'payment.captured' ? 'completed' : 'authorized'
        });
        
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        console.error('Error processing webhook payment:', error);
      }
    } else if (event === 'payment.failed') {
      // Handle payment failure
      const payment = req.body.payload.payment.entity;
      const orderId = payment.notes.order_id;
      
      const transaction = await db.transaction();
      try {
        // Update order status to failed
        await orderModel.updateOrderStatus(
          transaction,
          orderId,
          10, // Failed status
          'Payment failed via Razorpay webhook'
        );
        
        // Update payment info
        await orderModel.addOrderPaymentInfo(transaction, orderId, {
          payment_provider: 'razorpay',
          payment_order_id: payment.order_id,
          payment_id: payment.id,
          payment_status: 'failed',
          payment_error: payment.error_description || 'Payment failed'
        });
        
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        console.error('Error processing webhook payment failure:', error);
      }
    }
    
    // Always return 200 to Razorpay
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    // Still return 200 to prevent Razorpay from retrying
    res.status(200).json({ success: false, error: error.message });
  }
};

/**
 * Get payment details
 */
exports.getPaymentDetails = async (req, res) => {
  try {
    const { payment_id } = req.params;
    
    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }
    
    const instance = getRazorpayInstance();
    const payment = await instance.payments.fetch(payment_id);
    
    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};