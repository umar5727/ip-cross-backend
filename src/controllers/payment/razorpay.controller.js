/**
 * Razorpay Payment Controller
 * Production-ready controller with enhanced security and transaction handling
 */

const razorpayUtil = require('../../utils/razorpay.util');
const { getRazorpayInstance, withRetry } = require('../../utils/razorpay.util');
const orderModel = require('../../models/checkout/order.model');
const logger = require('../../utils/logger');
const razorpayConfig = require('../../config/razorpay.config');

/**
 * Database transaction wrapper
 */
async function withTransaction(operation) {
  const connection = await orderModel.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Execute database transaction
 */
async function executeTransaction(operation) {
  return await withTransaction(operation);
}

/**
 * Validate required fields in request body
 */
function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field]);
  return {
    isValid: missing.length === 0,
    missing: missing
  };
}

/**
 * Create standardized API response
 */
function createResponse(success, message, data = null, error = null) {
  const response = {
    success,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (error !== null) {
    response.error = error;
  }
  
  return response;
}

/**
 * Create Razorpay order with enhanced validation and transaction handling
 */
const createOrder = async (req, res) => {
  try {
    const { order_id, amount, currency = 'INR', notes = {} } = req.body;

    // Validate required fields
    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    // Use database transaction for consistency
    const result = await withTransaction(async (connection) => {
      // Verify order exists and get details
      const orderDetails = await orderModel.getOrderById(order_id, connection);
      
      if (!orderDetails) {
        throw new Error('Order not found');
      }

      // Validate order status
      if (orderDetails.order_status_id !== 1) { // Assuming 1 is 'pending'
        throw new Error('Order is not in a valid state for payment');
      }

      // Check if payment already exists
      const existingPayment = await orderModel.getOrderPaymentInfo(order_id, connection);
      if (existingPayment && existingPayment.payment_status === 'created') {
        // Return existing order if already created
        return {
          razorpay_order_id: existingPayment.payment_order_id,
          amount: existingPayment.amount || amount,
          currency,
          receipt: `order_${order_id}`,
          existing: true
        };
      }

      // Validate amount matches order total
      const orderTotal = parseFloat(orderDetails.total);
      const requestAmount = parseFloat(amount);
      
      if (Math.abs(orderTotal - requestAmount) > 0.01) {
        throw new Error(`Amount mismatch. Order total: ${orderTotal}, Requested: ${requestAmount}`);
      }

      // Create Razorpay order
      const orderData = {
        amount: requestAmount,
        currency,
        receipt: `order_${order_id}`,
        notes: {
          order_id,
          customer_id: orderDetails.customer_id,
          ...notes
        }
      };

      const razorpayOrderResponse = await razorpayUtil.createOrder(orderData);
      const razorpayOrder = razorpayOrderResponse.razorpay_order_id ? razorpayOrderResponse : razorpayOrderResponse;

      // Store payment information in database
      await orderModel.addOrderPaymentInfo({
        order_id,
        payment_provider: 'razorpay',
        payment_order_id: razorpayOrder.id,
        payment_status: 'created',
        amount: razorpayOrderResponse.validatedAmount ? razorpayOrderResponse.validatedAmount.amount : requestAmount,
        currency: razorpayOrderResponse.validatedAmount ? razorpayOrderResponse.validatedAmount.currency : currency,
        date_added: new Date(),
        date_modified: new Date()
      }, connection);

      // Update order status to 'awaiting payment'
      await orderModel.updateOrderStatus(order_id, 'awaiting_payment', connection);

      return {
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        created_at: razorpayOrder.created_at,
        validatedAmount: razorpayOrderResponse.validatedAmount
      };
    });

    logger.payment.orderCreated(order_id, result.razorpay_order_id, amount);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.payment.error('order_creation', error, {
      order_id: req.body.order_id,
      amount: req.body.amount
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Razorpay order'
    });
  }
};
/**
 * Verify Razorpay payment with enhanced security
 */
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification fields'
      });
    }

    // Use database transaction for consistency
    const result = await withTransaction(async (connection) => {
      // Verify signature
      const isValidSignature = razorpayUtil.verifyPaymentSignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      if (!isValidSignature) {
        logger.security.webhookValidationFailed('Invalid payment signature', req.ip);
        throw new Error('Payment signature verification failed');
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayUtil.fetchPaymentDetails(razorpay_payment_id);
      
      if (paymentDetails.status !== 'captured') {
        throw new Error(`Payment not captured. Status: ${paymentDetails.status}`);
      }

      // Verify order exists and get details
      const orderDetails = await orderModel.getOrderById(order_id, connection);
      if (!orderDetails) {
        throw new Error('Order not found');
      }

      // Verify amounts match
      const orderAmount = Math.round(parseFloat(orderDetails.total) * 100);
      if (paymentDetails.amount !== orderAmount) {
        throw new Error('Payment amount mismatch');
      }

      // Check for duplicate payment
      const existingPayment = await orderModel.getOrderPaymentInfo(order_id, connection);
      if (existingPayment && existingPayment.payment_id === razorpay_payment_id) {
        // Payment already processed
        return {
          status: 'already_processed',
          payment_id: razorpay_payment_id,
          order_id
        };
      }

      // Update payment information
      await orderModel.addOrderPaymentInfo({
        order_id,
        payment_provider: 'razorpay',
        payment_order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        payment_status: 'captured',
        amount: paymentDetails.amount / 100,
        currency: paymentDetails.currency,
        date_added: new Date(),
        date_modified: new Date()
      }, connection);

      // Update order status to 'paid'
      await orderModel.updateOrderStatus(order_id, 'paid', connection);

      return {
        status: 'success',
        payment_id: razorpay_payment_id,
        order_id,
        amount: paymentDetails.amount / 100
      };
    });

    logger.payment.paymentVerified(razorpay_payment_id, order_id, result.status);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.payment.error('payment_verification', error, {
      order_id: req.body.order_id,
      payment_id: req.body.razorpay_payment_id
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed'
    });
  }
};

/**
 * Handle Razorpay webhooks with enhanced security
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.webhookSignature;
    const timestamp = req.webhookTimestamp;
    const body = req.rawBody;

    // Verify webhook signature
    const isValidSignature = razorpayUtil.verifyWebhookSignature(body, signature, timestamp);
    
    if (!isValidSignature) {
      logger.security.webhookValidationFailed('Invalid webhook signature', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    const event = req.body;
    logger.payment.webhookReceived(event.event, event.payload?.payment?.entity?.id);

    // Process different webhook events
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      
      case 'refund.processed':
        await handleRefundProcessed(event.payload.refund.entity);
        break;
      
      default:
        logger.info('Unhandled webhook event', { event: event.event });
    }

    res.json({ success: true });

  } catch (error) {
    logger.payment.error('webhook_processing', error, {
      event: req.body?.event,
      payment_id: req.body?.payload?.payment?.entity?.id
    });

    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
};

/**
 * Handle payment captured webhook
 */
async function handlePaymentCaptured(payment) {
  try {
    await withTransaction(async (connection) => {
      const orderId = payment.notes?.order_id;
      
      if (!orderId) {
        logger.warn('Payment captured without order_id in notes', { payment_id: payment.id });
        return;
      }

      // Update payment status
      await orderModel.updatePaymentStatus(orderId, 'captured', connection);
      
      // Update order status if not already updated
      const orderDetails = await orderModel.getOrderById(orderId, connection);
      if (orderDetails && orderDetails.order_status !== 'paid') {
        await orderModel.updateOrderStatus(orderId, 'paid', connection);
      }
    });

    logger.payment.paymentVerified(payment.id, payment.notes?.order_id, 'webhook_captured');
  } catch (error) {
    logger.payment.error('webhook_payment_captured', error, { payment_id: payment.id });
  }
}

/**
 * Handle payment failed webhook
 */
async function handlePaymentFailed(payment) {
  try {
    await withTransaction(async (connection) => {
      const orderId = payment.notes?.order_id;
      
      if (!orderId) {
        logger.warn('Payment failed without order_id in notes', { payment_id: payment.id });
        return;
      }

      // Update payment status
      await orderModel.updatePaymentStatus(orderId, 'failed', connection);
      
      // Update order status back to pending
      await orderModel.updateOrderStatus(orderId, 'pending', connection);
    });

    logger.payment.error('payment_failed_webhook', new Error('Payment failed'), {
      payment_id: payment.id,
      order_id: payment.notes?.order_id
    });
  } catch (error) {
    logger.payment.error('webhook_payment_failed', error, { payment_id: payment.id });
  }
}

/**
 * Handle refund processed webhook
 */
async function handleRefundProcessed(refund) {
  try {
    await withTransaction(async (connection) => {
      // Update refund status in database
      await orderModel.updateRefundStatus(refund.payment_id, 'processed', refund.amount, connection);
    });

    logger.payment.refundProcessed(refund.id, refund.payment_id, refund.amount / 100);
  } catch (error) {
    logger.payment.error('webhook_refund_processed', error, { refund_id: refund.id });
  }
}

/**
 * Create refund
 */
const createRefund = async (req, res) => {
  try {
    const { payment_id, amount, reason = 'requested_by_customer' } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required'
      });
    }

    const refund = await razorpayUtil.createRefund(payment_id, amount, { reason });

    res.json({
      success: true,
      data: {
        refund_id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });

  } catch (error) {
    logger.payment.error('refund_creation', error, {
      payment_id: req.body.payment_id,
      amount: req.body.amount
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Refund creation failed'
    });
  }
};



/**
 * Handle Razorpay webhooks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const webhook = async (req, res) => {
  try {
    const webhookBody = req.body;
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    logger.info('Received webhook', { event: webhookBody.event });
    
    // Verify webhook signature if secret is configured
    if (process.env.RAZORPAY_WEBHOOK_SECRET) {
      if (!webhookSignature) {
        logger.error('Missing webhook signature');
        return res.status(400).json(createResponse(false, 'Missing webhook signature'));
      }
      
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(webhookBody))
        .digest('hex');
      
      if (generatedSignature !== webhookSignature) {
        logger.error('Invalid webhook signature');
        return res.status(400).json(createResponse(false, 'Invalid webhook signature'));
      }
    }
    
    // Process webhook events
    try {
      switch (webhookBody.event) {
        case 'payment.captured':
          await handlePaymentCaptured(webhookBody.payload.payment.entity);
          break;
        case 'payment.failed':
          await handlePaymentFailed(webhookBody.payload.payment.entity);
          break;
        case 'refund.created':
          await handleRefundCreated(webhookBody.payload.refund.entity);
          break;
        default:
          logger.info(`Unhandled webhook event: ${webhookBody.event}`);
      }
    } catch (processingError) {
      logger.error('Error processing webhook event', processingError);
      // Still return 200 to prevent Razorpay retries
    }
    
    return res.status(200).json(createResponse(true, 'Webhook processed'));
    
  } catch (error) {
    logger.error('Webhook processing error', error);
    return res.status(200).json(createResponse(true, 'Webhook acknowledged'));
  }
};

/**
 * Handle refund created webhook
 * @param {Object} refund - Refund entity
 */
const handleRefundCreated = async (refund) => {
  const paymentId = refund.payment_id;
  logger.info('Processing refund created webhook', {
    refund_id: refund.id,
    payment_id: paymentId
  });
  
  try {
    const instance = getRazorpayInstance();
    const payment = await withRetry(() => instance.payments.fetch(paymentId));
    
    if (!payment.notes?.order_id) {
      logger.error('Payment missing order_id in notes', { payment_id: paymentId });
      return;
    }
    
    const orderId = payment.notes.order_id;
    
    await executeTransaction(async (transaction) => {
      await orderModel.updateOrderStatus(
        transaction,
        orderId,
        11, // Refunded status
        'Payment refunded via webhook'
      );
      
      await orderModel.addOrderPaymentInfo(transaction, orderId, {
        payment_provider: 'razorpay',
        payment_order_id: payment.order_id,
        payment_id: paymentId,
        payment_status: 'refunded',
        refund_id: refund.id,
        refund_amount: refund.amount / 100,
        webhook_processed_at: new Date()
      });
    });
    
    logger.info('Refund webhook processed successfully', {
      order_id: orderId,
      refund_id: refund.id
    });
  } catch (error) {
    logger.error('Error processing refund webhook', error);
  }
};

/**
 * Get payment details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentDetails = async (req, res) => {
  try {
    const { payment_id } = req.params;
    
    if (!payment_id) {
      logger.error('Missing payment ID parameter');
      return res.status(400).json(
        createResponse(false, 'Payment ID is required')
      );
    }
    
    logger.info('Fetching payment details', { payment_id });
    
    const instance = getRazorpayInstance();
    const payment = await withRetry(() => instance.payments.fetch(payment_id));
    
    logger.info('Payment details fetched successfully', { payment_id });
    
    return res.status(200).json(
      createResponse(true, 'Payment details retrieved', { payment })
    );
    
  } catch (error) {
    logger.error('Error fetching payment details', error);
    return res.status(500).json(
      createResponse(false, 'Failed to fetch payment details', null, error.message)
    );
  }
};

/**
 * Get user payments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserPayments = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    
    if (!customerId) {
      logger.error('Missing customer ID in request');
      return res.status(401).json(
        createResponse(false, 'Authentication required')
      );
    }
    
    logger.info('Fetching user payments', { customer_id: customerId });
    
    const [payments] = await db.sequelize.query(
      `SELECT opi.*, o.date_added, o.total 
       FROM oc_order_payment_info opi
       JOIN oc_order o ON opi.order_id = o.order_id
       WHERE o.customer_id = :customer_id AND opi.payment_provider = 'razorpay'
       ORDER BY o.date_added DESC`,
      {
        replacements: { customer_id: customerId },
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    
    logger.info('User payments fetched successfully', {
      customer_id: customerId,
      count: payments.length
    });
    
    return res.status(200).json(
      createResponse(true, 'Payment history retrieved', { payments })
    );
    
  } catch (error) {
    logger.error('Error fetching user payments', error);
    return res.status(500).json(
      createResponse(false, 'Failed to fetch payment history', null, error.message)
    );
  }
};

/**
 * Process refund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processRefund = async (req, res) => {
  try {
    const { payment_id, amount, notes } = req.body;
    
    // Validate required fields
    const validation = validateRequiredFields(req.body, ['payment_id']);
    if (!validation.isValid) {
      logger.error('Missing payment ID for refund');
      return res.status(400).json(
        createResponse(false, 'Payment ID is required')
      );
    }
    
    // Validate amount if provided
    if (amount !== undefined) {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        logger.error('Invalid refund amount', { amount });
        return res.status(400).json(
          createResponse(false, 'Refund amount must be a positive number')
        );
      }
    }
    
    logger.info('Processing refund request', { payment_id, amount });
    
    const instance = getRazorpayInstance();
    
    // Fetch payment details to verify
    const payment = await withRetry(() => instance.payments.fetch(payment_id));
    
    if (payment.status !== 'captured') {
      logger.error('Cannot refund uncaptured payment', {
        payment_id,
        status: payment.status
      });
      return res.status(400).json(
        createResponse(false, `Cannot refund payment with status: ${payment.status}`)
      );
    }
    
    // Prepare refund options
    const refundOptions = {
      payment_id,
      notes: notes || {}
    };
    
    if (amount) {
      refundOptions.amount = Math.round(parseFloat(amount) * 100); // Convert to paise
    }
    
    // Process refund
    const refund = await withRetry(() => instance.payments.refund(payment_id, refundOptions));
    
    logger.info('Refund processed successfully', {
      refund_id: refund.id,
      payment_id
    });
    
    // Update database if order_id is available
    if (payment.notes?.order_id) {
      const orderId = payment.notes.order_id;
      
      try {
        await executeTransaction(async (transaction) => {
          await orderModel.updateOrderStatus(
            transaction,
            orderId,
            11, // Refunded status
            'Payment refunded successfully'
          );
          
          await orderModel.addOrderPaymentInfo(transaction, orderId, {
            payment_provider: 'razorpay',
            payment_order_id: payment.order_id,
            payment_id: payment_id,
            payment_status: 'refunded',
            refund_id: refund.id,
            refund_amount: (refund.amount || payment.amount) / 100,
            refunded_at: new Date()
          });
        });
        
        logger.info('Order updated with refund information', { order_id: orderId });
      } catch (dbError) {
        logger.error('Failed to update database with refund info', dbError);
        // Continue with response as refund was processed
      }
    }
    
    return res.status(200).json(
      createResponse(true, 'Refund processed successfully', { refund })
    );
    
  } catch (error) {
    logger.error('Error processing refund', error);
    return res.status(500).json(
      createResponse(false, 'Failed to process refund', null, error.message)
    );
  }
};

// Export all controller methods
module.exports = {
  createOrder,
  verifyPayment,
  webhook,
  handleWebhook: webhook, // Alias for webhook
  createRefund,
  getPaymentDetails,
  getUserPayments,
  processRefund,
  // Export utility functions for testing
  getRazorpayInstance,
  withRetry,
  validateRequiredFields,
  createResponse,
  executeTransaction
};