/**
 * Razorpay Utility
 * Handles Razorpay API interactions
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const axios = require('axios');
const razorpayConfig = require('../config/razorpay.config');
const logger = require('./logger');

// Initialize Razorpay instance with secure configuration
let razorpayInstance = null;

function getRazorpayInstance() {
  if (!razorpayInstance) {
    const credentials = razorpayConfig.getApiCredentials();
    razorpayInstance = new Razorpay({
      key_id: credentials.key_id,
      key_secret: credentials.key_secret
    });
  }
  return razorpayInstance;
}

/**
 * Retry wrapper for API calls
 */
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry for client errors (4xx)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      logger.warn(`Razorpay API attempt ${attempt} failed, retrying...`, {
        error: error.message,
        attempt,
        maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
}

/**
 * Validate and sanitize amount with precision handling
 */
function validateAmount(amount, currency = 'INR') {
  if (!amount && amount !== 0) {
    throw new Error('Amount is required');
  }

  // Handle string inputs and convert to number
  let numAmount;
  if (typeof amount === 'string') {
    // Remove any non-numeric characters except decimal point
    const cleanAmount = amount.replace(/[^\d.-]/g, '');
    numAmount = parseFloat(cleanAmount);
  } else {
    numAmount = parseFloat(amount);
  }

  // Check if conversion resulted in valid number
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount < 0) {
    throw new Error('Invalid amount: must be a valid positive number');
  }

  // Handle precision issues with floating point arithmetic
  // Convert to paise/cents for accurate calculations
  const amountInSmallestUnit = Math.round(numAmount * 100);
  const finalAmount = amountInSmallestUnit / 100;

  // Currency-specific validation
  const currencyConfig = {
    'INR': { min: 0.5, max: 100000000, decimals: 2 }, // 50 paise to 10 crores
    'USD': { min: 0.01, max: 1000000, decimals: 2 },  // 1 cent to 1 million
    'EUR': { min: 0.01, max: 1000000, decimals: 2 },  // 1 cent to 1 million
    'GBP': { min: 0.01, max: 1000000, decimals: 2 },  // 1 penny to 1 million
  };

  const config = currencyConfig[currency] || currencyConfig['INR'];

  // Minimum amount validation
  if (finalAmount < config.min) {
    throw new Error(`Amount must be at least ${config.min} ${currency}`);
  }

  // Maximum amount validation
  if (finalAmount > config.max) {
    throw new Error(`Amount cannot exceed ${config.max} ${currency}`);
  }

  // Check decimal places
  const decimalPlaces = (finalAmount.toString().split('.')[1] || '').length;
  if (decimalPlaces > config.decimals) {
    throw new Error(`Amount cannot have more than ${config.decimals} decimal places for ${currency}`);
  }

  // Return amount in smallest currency unit (paise for INR, cents for USD, etc.)
  return {
    amount: finalAmount,
    amountInSmallestUnit: amountInSmallestUnit,
    currency: currency,
    formatted: `${finalAmount.toFixed(config.decimals)} ${currency}`
  };
}

// Base URL for Razorpay API
const RAZORPAY_API = 'https://api.razorpay.com/v1';

/**
 * Create a Razorpay order with enhanced validation and error handling
 * @param {Object} orderData - Order details
 * @returns {Promise<Object>} Razorpay order response
 */
exports.createOrder = async (orderData) => {
  try {
    // Validate required fields
    if (!orderData.amount) {
      throw new Error('Amount is required');
    }
    if (!orderData.receipt) {
      throw new Error('Receipt is required');
    }

    // Validate and sanitize amount
    const validatedAmount = validateAmount(orderData.amount, orderData.currency);
    
    const options = {
      amount: validatedAmount.amountInSmallestUnit, // Use pre-calculated smallest unit
      currency: validatedAmount.currency,
      receipt: orderData.receipt.toString().substring(0, 40), // Razorpay limit
      notes: orderData.notes || {},
      payment_capture: 1 // Auto capture
    };

    // Add timeout to prevent hanging requests
    const razorpay = getRazorpayInstance();
    
    const order = await withRetry(async () => {
      return await Promise.race([
        razorpay.orders.create(options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Razorpay API timeout')), 
          razorpayConfig.getConfig().timeout)
        )
      ]);
    }, razorpayConfig.getConfig().max_retries, razorpayConfig.getConfig().retry_delay);

    logger.payment.orderCreated(orderData.receipt, order.id, validatedAmount.formatted);
    
    return {
      ...order,
      validatedAmount: validatedAmount
    };
  } catch (error) {
    logger.payment.error('order_creation', error, {
      receipt: orderData.receipt,
      amount: orderData.amount
    });
    throw error;
  }
};

/**
 * Verify Razorpay payment signature with enhanced security
 * @param {Object} paymentData - Payment verification data
 * @returns {boolean} - Verification result
 */
function verifyPaymentSignature(paymentData) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      logger.security.webhookValidationFailed('Missing required signature fields', 'unknown');
      return false;
    }

    const webhookSecret = razorpayConfig.getWebhookSecret();
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body.toString())
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (isValid) {
      logger.payment.paymentVerified(razorpay_payment_id, razorpay_order_id, 'signature_verified');
    } else {
      logger.security.webhookValidationFailed('Invalid signature', 'unknown');
    }

    return isValid;
  } catch (error) {
    logger.payment.error('signature_verification', error, paymentData);
    return false;
  }
}

/**
 * Verify webhook signature with replay attack protection
 * @param {string} webhookBody - Raw webhook body
 * @param {string} webhookSignature - Webhook signature from headers
 * @param {number} webhookTimestamp - Webhook timestamp
 * @returns {boolean} - Verification result
 */
function verifyWebhookSignature(webhookBody, webhookSignature, webhookTimestamp) {
  try {
    if (!webhookBody || !webhookSignature) {
      logger.security.webhookValidationFailed('Missing webhook signature or body', 'unknown');
      return false;
    }

    // Check timestamp to prevent replay attacks
    const currentTime = Math.floor(Date.now() / 1000);
    const tolerance = razorpayConfig.getConfig().webhook_tolerance;
    
    if (webhookTimestamp && Math.abs(currentTime - webhookTimestamp) > tolerance) {
      logger.security.webhookValidationFailed('Webhook timestamp too old', 'unknown');
      return false;
    }

    const webhookSecret = razorpayConfig.getWebhookSecret();
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(webhookSignature, 'hex')
    );

    if (!isValid) {
      logger.security.webhookValidationFailed('Invalid webhook signature', 'unknown');
    }

    return isValid;
  } catch (error) {
    logger.payment.error('webhook_verification', error, {
      hasBody: !!webhookBody,
      hasSignature: !!webhookSignature,
      timestamp: webhookTimestamp
    });
    return false;
  }
}

/**
 * Fetch payment details with retry mechanism
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
async function fetchPaymentDetails(paymentId) {
  try {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    const razorpay = getRazorpayInstance();
    
    const payment = await withRetry(async () => {
      return await Promise.race([
        razorpay.payments.fetch(paymentId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Payment fetch timeout')), 
          razorpayConfig.getConfig().timeout)
        )
      ]);
    });

    return payment;
  } catch (error) {
    logger.payment.error('payment_fetch', error, { payment_id: paymentId });
    throw error;
  }
}

/**
 * Create refund with validation
 * @param {string} paymentId - Payment ID to refund
 * @param {number} amount - Refund amount (optional, full refund if not provided)
 * @param {string} currency - Currency for amount validation
 * @param {Object} notes - Additional notes
 * @returns {Promise<Object>} Refund details
 */
async function createRefund(paymentId, amount = null, currency = 'INR', notes = {}) {
  try {
    if (!paymentId) {
      throw new Error('Payment ID is required for refund');
    }

    const razorpay = getRazorpayInstance();
    const refundData = { notes };
    
    if (amount) {
      const validatedAmount = validateAmount(amount, currency);
      refundData.amount = validatedAmount.amountInSmallestUnit; // Use pre-calculated smallest unit
    }

    const refund = await withRetry(async () => {
      return await Promise.race([
        razorpay.payments.refund(paymentId, refundData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Refund creation timeout')), 
          razorpayConfig.getConfig().timeout)
        )
      ]);
    });

    logger.payment.refundProcessed(refund.id, paymentId, amount);
    return refund;
  } catch (error) {
    logger.payment.error('refund_creation', error, {
      payment_id: paymentId,
      amount
    });
    throw error;
  }
}

module.exports = {
  createOrder: exports.createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentDetails,
  createRefund,
  getRazorpayInstance,
  validateAmount,
  withRetry
};