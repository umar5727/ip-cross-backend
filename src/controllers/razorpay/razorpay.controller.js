const crypto = require('crypto');
const { razorpay, RAZORPAY_CONFIG } = require('../../../config/razorpay');
const { 
  MobileRazorpayOrder, 
  MobileRazorpayWebhookLog, 
  MobileRazorpayRefund,
  Order,
  Customer 
} = require('../../models');
const sequelize = require('../../../config/database');

class RazorpayController {
  
  /**
   * Create Razorpay order for mobile payment
   * POST /api/razorpay/create-order
   */
  async createOrder(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { amount, currency = 'INR', customer_id, notes = {} } = req.body;
      
      // Validate required fields
      if (!amount || !customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Amount and customer_id are required'
        });
      }

      // Validate customer exists
      const customer = await Customer.findByPk(customer_id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Convert amount to paise (Razorpay expects amount in smallest currency unit)
      const amountInPaise = Math.round(amount * 100);
      
      // Generate receipt ID
      const receipt = `${RAZORPAY_CONFIG.receipt_prefix}${Date.now()}_${customer_id}`;
      
      // Create Razorpay order
      const razorpayOrderOptions = {
        amount: amountInPaise,
        currency: currency,
        receipt: receipt,
        payment_capture: RAZORPAY_CONFIG.payment_capture,
        notes: {
          customer_id: customer_id,
          platform: 'mobile',
          ...notes
        }
      };

      const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);
      
      // Save order to mobile_razorpay_order table
      const mobileOrder = await MobileRazorpayOrder.create({
        razorpay_order_id: razorpayOrder.id,
        customer_id: customer_id,
        amount: amountInPaise,
        currency: currency,
        receipt: receipt,
        status: 'created',
        notes: razorpayOrderOptions.notes
      }, { transaction });

      await transaction.commit();

      // Return order details for Flutter integration
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt,
          key_id: process.env.RAZORPAY_KEY_ID,
          // Additional data for Flutter Razorpay integration
          mobile_order_id: mobileOrder.id,
          customer_id: customer_id,
          prefill: {
            name: customer.firstname + ' ' + customer.lastname,
            email: customer.email,
            contact: customer.telephone
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Create order error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Verify payment signature and update order status
   * POST /api/razorpay/verify-payment
   */
  async verifyPayment(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature 
      } = req.body;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Order ID, Payment ID, and Signature are required'
        });
      }

      // Find mobile order
      const mobileOrder = await MobileRazorpayOrder.findOne({
        where: { razorpay_order_id: razorpay_order_id }
      });

      if (!mobileOrder) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Verify signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      const isSignatureValid = expectedSignature === razorpay_signature;

      if (!isSignatureValid) {
        // Update order status to failed
        await mobileOrder.update({
          status: 'failed',
          razorpay_payment_id: razorpay_payment_id,
          razorpay_signature: razorpay_signature
        }, { transaction });

        await transaction.commit();

        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature'
        });
      }

      // Fetch payment details from Razorpay
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      
      // Update mobile order status
      await mobileOrder.update({
        status: 'paid',
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        payment_method: payment.method
      }, { transaction });

      // Create or update OpenCart order for consistency
      const ocOrder = await Order.create({
        customer_id: mobileOrder.customer_id,
        total: mobileOrder.amount / 100, // Convert back to rupees
        order_status_id: 2, // Processing status
        payment_method: 'razorpay',
        payment_code: 'razorpay',
        date_added: new Date(),
        date_modified: new Date()
      }, { transaction });

      // Update mobile order with OpenCart order reference
      await mobileOrder.update({
        oc_order_id: ocOrder.order_id
      }, { transaction });

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          status: 'paid',
          oc_order_id: ocOrder.order_id,
          amount: mobileOrder.amount / 100,
          payment_method: payment.method
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Verify payment error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create refund for a payment
   * POST /api/razorpay/refund
   */
  async createRefund(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { 
        payment_id, 
        amount, 
        reason = 'requested_by_customer',
        receipt,
        notes = {} 
      } = req.body;

      // Validate required fields
      if (!payment_id) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      // Find mobile order by payment ID
      const mobileOrder = await MobileRazorpayOrder.findOne({
        where: { razorpay_payment_id: payment_id }
      });

      if (!mobileOrder) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (mobileOrder.status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Can only refund paid orders'
        });
      }

      // Prepare refund options
      const refundOptions = {
        payment_id: payment_id,
        notes: {
          reason: reason,
          order_id: mobileOrder.razorpay_order_id,
          ...notes
        }
      };

      // Add amount if partial refund
      if (amount) {
        const amountInPaise = Math.round(amount * 100);
        if (amountInPaise > mobileOrder.amount) {
          return res.status(400).json({
            success: false,
            message: 'Refund amount cannot exceed original payment amount'
          });
        }
        refundOptions.amount = amountInPaise;
      }

      if (receipt) {
        refundOptions.receipt = receipt;
      }

      // Create refund with Razorpay (or mock for test mode)
      let refund;
      
      // Check if this is a mock payment ID (for testing)
      if (payment_id.startsWith('pay_mock_')) {
        // Create mock refund response for testing
        refund = {
          id: `rfnd_mock_${Date.now()}`,
          entity: 'refund',
          amount: refundOptions.amount || mobileOrder.amount,
          currency: 'INR',
          payment_id: payment_id,
          notes: refundOptions.notes,
          receipt: refundOptions.receipt || null,
          acquirer_data: {
            arn: null
          },
          created_at: Math.floor(Date.now() / 1000),
          batch_id: null,
          status: 'processed',
          speed_processed: 'normal',
          speed_requested: 'normal'
        };
        console.log('🧪 Mock refund created for testing:', refund.id);
      } else {
        // Real Razorpay API call for production
        refund = await razorpay.payments.refund(payment_id, refundOptions);
      }
      
      // Determine refund type
      const refundType = amount && (Math.round(amount * 100) < mobileOrder.amount) ? 'partial' : 'full';
      
      // Save refund to database
      const mobileRefund = await MobileRazorpayRefund.create({
        razorpay_refund_id: refund.id,
        razorpay_payment_id: payment_id,
        razorpay_order_id: mobileOrder.razorpay_order_id,
        oc_order_id: mobileOrder.oc_order_id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        refund_type: refundType,
        reason: reason,
        receipt: refund.receipt,
        notes: refundOptions.notes
      }, { transaction });

      // Update mobile order status if full refund
      if (refundType === 'full') {
        await mobileOrder.update({
          status: 'refunded'
        }, { transaction });

        // Update OpenCart order status
        if (mobileOrder.oc_order_id) {
          await Order.update({
            order_status_id: 11 // Refunded status
          }, {
            where: { order_id: mobileOrder.oc_order_id },
            transaction
          });
        }
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: 'Refund created successfully',
        data: {
          refund_id: refund.id,
          payment_id: payment_id,
          amount: refund.amount / 100,
          currency: refund.currency,
          status: refund.status,
          refund_type: refundType,
          receipt: refund.receipt
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Create refund error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to create refund',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create payment link/invoice
   * POST /api/razorpay/create-invoice
   */
  async createInvoice(req, res) {
    try {
      const { 
        amount, 
        currency = 'INR', 
        customer_id, 
        description = 'Payment for order',
        expire_by,
        notes = {} 
      } = req.body;

      // Validate required fields
      if (!amount || !customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Amount and customer_id are required'
        });
      }

      // Validate customer exists
      const customer = await Customer.findByPk(customer_id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Convert amount to paise
      const amountInPaise = Math.round(amount * 100);
      
      // Prepare payment link options
      const paymentLinkOptions = {
        amount: amountInPaise,
        currency: currency,
        description: description,
        customer: {
          name: customer.firstname + ' ' + customer.lastname,
          email: customer.email,
          contact: customer.telephone
        },
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        notes: {
          customer_id: customer_id,
          platform: 'mobile',
          ...notes
        }
      };

      if (expire_by) {
        paymentLinkOptions.expire_by = Math.floor(new Date(expire_by).getTime() / 1000);
      }

      // Create payment link
      const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

      res.status(201).json({
        success: true,
        message: 'Payment link created successfully',
        data: {
          payment_link_id: paymentLink.id,
          payment_link_url: paymentLink.short_url,
          amount: paymentLink.amount / 100,
          currency: paymentLink.currency,
          description: paymentLink.description,
          status: paymentLink.status,
          expire_by: paymentLink.expire_by ? new Date(paymentLink.expire_by * 1000) : null
        }
      });

    } catch (error) {
      console.error('Create invoice error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to create payment link',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Handle Razorpay webhooks
   * POST /api/razorpay/webhook
   */
  async handleWebhook(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const webhookSignature = req.headers['x-razorpay-signature'];
      const webhookBody = JSON.stringify(req.body);
      
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(webhookBody)
        .digest('hex');

      const isSignatureValid = expectedSignature === webhookSignature;
      
      // Log webhook regardless of signature validity
      const webhookLog = await MobileRazorpayWebhookLog.create({
        event_id: req.body.event,
        event_type: req.body.event,
        entity_type: req.body.payload?.payment?.entity || req.body.payload?.order?.entity || 'unknown',
        entity_id: req.body.payload?.payment?.id || req.body.payload?.order?.id || 'unknown',
        payload: req.body,
        signature: webhookSignature,
        signature_verified: isSignatureValid,
        processed: false
      }, { transaction });

      if (!isSignatureValid) {
        await transaction.commit();
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      // Process webhook based on event type
      const eventType = req.body.event;
      const payload = req.body.payload;

      switch (eventType) {
        case 'payment.captured':
          await this.handlePaymentCaptured(payload.payment, transaction);
          break;
          
        case 'payment.failed':
          await this.handlePaymentFailed(payload.payment, transaction);
          break;
          
        case 'payment.refunded':
          await this.handlePaymentRefunded(payload.payment, payload.refund, transaction);
          break;
          
        case 'order.paid':
          await this.handleOrderPaid(payload.order, transaction);
          break;
          
        default:
          console.log(`Unhandled webhook event: ${eventType}`);
      }

      // Mark webhook as processed
      await webhookLog.update({
        processed: true
      }, { transaction });

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      await transaction.rollback();
      
      // Update webhook log with error
      if (req.body.event) {
        await MobileRazorpayWebhookLog.update({
          processing_error: error.message,
          retry_count: sequelize.literal('retry_count + 1')
        }, {
          where: { event_id: req.body.event }
        });
      }

      console.error('Webhook processing error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Helper methods for webhook processing
  async handlePaymentCaptured(payment, transaction) {
    const mobileOrder = await MobileRazorpayOrder.findOne({
      where: { razorpay_order_id: payment.order_id }
    });

    if (mobileOrder) {
      await mobileOrder.update({
        status: 'paid',
        razorpay_payment_id: payment.id,
        payment_method: payment.method
      }, { transaction });
    }
  }

  async handlePaymentFailed(payment, transaction) {
    const mobileOrder = await MobileRazorpayOrder.findOne({
      where: { razorpay_order_id: payment.order_id }
    });

    if (mobileOrder) {
      await mobileOrder.update({
        status: 'failed',
        razorpay_payment_id: payment.id
      }, { transaction });
    }
  }

  async handlePaymentRefunded(payment, refund, transaction) {
    const mobileOrder = await MobileRazorpayOrder.findOne({
      where: { razorpay_payment_id: payment.id }
    });

    if (mobileOrder) {
      // Update refund record if exists
      await MobileRazorpayRefund.update({
        status: 'processed',
        processed_at: new Date()
      }, {
        where: { razorpay_refund_id: refund.id },
        transaction
      });

      // Check if full refund
      if (refund.amount >= mobileOrder.amount) {
        await mobileOrder.update({
          status: 'refunded'
        }, { transaction });
      }
    }
  }

  async handleOrderPaid(order, transaction) {
    const mobileOrder = await MobileRazorpayOrder.findOne({
      where: { razorpay_order_id: order.id }
    });

    if (mobileOrder && mobileOrder.status !== 'paid') {
      await mobileOrder.update({
        status: 'paid'
      }, { transaction });
    }
  }

  /**
   * Get payment status
   * GET /api/razorpay/payment-status/:order_id
   */
  async getPaymentStatus(req, res) {
    try {
      const { order_id } = req.params;
      
      const mobileOrder = await MobileRazorpayOrder.findOne({
        where: { razorpay_order_id: order_id }
      });

      if (!mobileOrder) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          order_id: mobileOrder.razorpay_order_id,
          status: mobileOrder.status,
          amount: mobileOrder.amount / 100,
          currency: mobileOrder.currency,
          payment_id: mobileOrder.razorpay_payment_id,
          payment_method: mobileOrder.payment_method,
          oc_order_id: mobileOrder.oc_order_id,
          created_at: mobileOrder.created_at,
          updated_at: mobileOrder.updated_at
        }
      });

    } catch (error) {
      console.error('Get payment status error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get payment status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new RazorpayController();