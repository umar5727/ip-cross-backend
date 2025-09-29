/**
 * Razorpay Utility
 * Handles Razorpay API interactions
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration - should be moved to environment variables in production
const config = {
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_your_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_key_secret',
  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret'
};

// Base URL for Razorpay API
const RAZORPAY_API = 'https://api.razorpay.com/v1';

/**
 * Create a Razorpay order
 * @param {Object} orderData - Order data including amount, currency, receipt, notes
 * @returns {Promise<Object>} - Razorpay order object
 */
exports.createOrder = async (orderData) => {
  try {
    const response = await axios({
      method: 'post',
      url: `${RAZORPAY_API}/orders`,
      auth: {
        username: config.key_id,
        password: config.key_secret
      },
      data: orderData
    });
    
    return response.data;
  } catch (error) {
    console.error('Razorpay create order error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.description || 'Failed to create Razorpay order');
  }
};

/**
 * Verify Razorpay payment signature
 * @param {Object} params - Payment verification parameters
 * @returns {Boolean} - Whether signature is valid
 */
exports.verifyPaymentSignature = (params) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
    
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.key_secret)
      .update(text)
      .digest('hex');
    
    return expectedSignature === razorpay_signature;
  } catch (error) {
    console.error('Razorpay signature verification error:', error);
    return false;
  }
};

/**
 * Verify webhook signature
 * @param {String} body - Request body as string
 * @param {String} signature - X-Razorpay-Signature header
 * @returns {Boolean} - Whether signature is valid
 */
exports.verifyWebhookSignature = (body, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.webhook_secret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('Razorpay webhook verification error:', error);
    return false;
  }
};

/**
 * Fetch payment details from Razorpay
 * @param {String} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} - Payment details
 */
exports.fetchPayment = async (paymentId) => {
  try {
    const response = await axios({
      method: 'get',
      url: `${RAZORPAY_API}/payments/${paymentId}`,
      auth: {
        username: config.key_id,
        password: config.key_secret
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Razorpay fetch payment error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.description || 'Failed to fetch payment details');
  }
};

/**
 * Capture an authorized payment
 * @param {String} paymentId - Razorpay payment ID
 * @param {Number} amount - Amount to capture in paise
 * @returns {Promise<Object>} - Capture response
 */
exports.capturePayment = async (paymentId, amount) => {
  try {
    const response = await axios({
      method: 'post',
      url: `${RAZORPAY_API}/payments/${paymentId}/capture`,
      auth: {
        username: config.key_id,
        password: config.key_secret
      },
      data: { amount }
    });
    
    return response.data;
  } catch (error) {
    console.error('Razorpay capture payment error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.description || 'Failed to capture payment');
  }
};

/**
 * Format order data for Razorpay
 * @param {Object} order - Order data from our system
 * @returns {Object} - Formatted data for Razorpay API
 */
exports.formatOrderData = (order) => {
  // Convert to paise (Razorpay uses smallest currency unit)
  const amountInPaise = Math.round(order.total * 100);
  
  return {
    amount: amountInPaise,
    currency: 'INR',
    receipt: `order_${order.order_id}`,
    notes: {
      order_id: order.order_id,
      customer_id: order.customer_id,
      customer_email: order.email,
      customer_phone: order.telephone
    }
  };
};