const ClickPostService = require('../../services/clickpost.service');
const ClickPostOrder = require('../../models/clickpost/clickpost_order.model');
const { Order } = require('../../models');

/**
 * Track order by AWB number
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.trackOrder = async (req, res) => {
  try {
    const { awb } = req.params;

    if (!awb) {
      return res.status(400).json({
        success: false,
        message: 'AWB number is required'
      });
    }

    // Get order details from database
    const orderData = await ClickPostOrder.getOrderByAwb(awb);
    
    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with this AWB number'
      });
    }

    // Get courier partner ID
    const cpId = orderData.courier_partner_id;
    if (!cpId) {
      return res.status(400).json({
        success: false,
        message: 'Courier partner information not available for this order'
      });
    }

    // Track order via ClickPost API
    const trackingResult = await ClickPostService.trackOrder(awb, cpId);

    if (!trackingResult.success) {
      return res.status(400).json({
        success: false,
        message: trackingResult.error || 'Unable to track order at this time',
        data: {
          awb: awb,
          order_id: orderData.ipshopy_order_id,
          courier_name: orderData.courier_name
        }
      });
    }

    // Update order status in database if status changed
    if (trackingResult.status && trackingResult.status !== 'Unknown') {
      // Map ClickPost status to order status ID
      const statusMapping = {
        'Pickup Scheduled': 13, // Ready to Dispatch (RTD)
        'Picked Up': 3,        // Shipped
        'In Transit': 3,        // Shipped
        'Out for Delivery': 3,  // Shipped
        'Delivered': 5,         // Complete
        'Cancelled': 7,         // Cancelled
        'Returned': 12,         // Reversed
        'RTO': 12,              // Reversed
        'Failed': 10,           // Failed
        'Expired': 14           // Expired
      };

      const newStatusId = statusMapping[trackingResult.status] || orderData.order_status_id;
      
      if (newStatusId !== orderData.order_status_id) {
        await ClickPostOrder.updateOrderStatus(orderData.ipshopy_order_id, newStatusId);
        
        // Also update main order table
        await Order.update(
          { order_status_id: newStatusId },
          { where: { order_id: orderData.ipshopy_order_id } }
        );
      }
    }

    // Return raw ClickPost data (like OpenCart does)
    res.status(200).json({
      success: true,
      message: 'Order tracking successful',
      data: {
        awb: awb,
        order_id: orderData.ipshopy_order_id,
        courier_name: orderData.courier_name,
        courier_partner_id: orderData.courier_partner_id,
        current_status: trackingResult.status,
        status_code: trackingResult.statusCode,
        tracking_history: trackingResult.history || [],
        reference_number: orderData.reference_number,
        label_url: orderData.label_url,
        commercial_invoice_url: orderData.commercial_invoice_url,
        clickpost_raw_data: trackingResult.data  // Raw ClickPost API response
      }
    });

  } catch (error) {
    console.error('Order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking order'
    });
  }
};

/**
 * Track order by order ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.trackOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get order details from database
    const orderData = await ClickPostOrder.getOrderById(orderId);
    
    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not shipped yet'
      });
    }

    if (!orderData.waybill) {
      return res.status(400).json({
        success: false,
        message: 'AWB number not available for this order'
      });
    }

    // Get courier partner ID
    const cpId = orderData.courier_partner_id;
    if (!cpId) {
      return res.status(400).json({
        success: false,
        message: 'Courier partner information not available for this order'
      });
    }

    // Track order via ClickPost API
    const trackingResult = await ClickPostService.trackOrder(orderData.waybill, cpId);

    if (!trackingResult.success) {
      return res.status(400).json({
        success: false,
        message: trackingResult.error || 'Unable to track order at this time',
        data: {
          awb: orderData.waybill,
          order_id: orderData.ipshopy_order_id,
          courier_name: orderData.courier_name
        }
      });
    }

    // Update order status in database if status changed
    if (trackingResult.status && trackingResult.status !== 'Unknown') {
      // Map ClickPost status to order status ID
      const statusMapping = {
        'Pickup Scheduled': 13, // Ready to Dispatch (RTD)
        'Picked Up': 3,        // Shipped
        'In Transit': 3,        // Shipped
        'Out for Delivery': 3,  // Shipped
        'Delivered': 5,         // Complete
        'Cancelled': 7,         // Cancelled
        'Returned': 12,         // Reversed
        'RTO': 12,              // Reversed
        'Failed': 10,           // Failed
        'Expired': 14           // Expired
      };

      const newStatusId = statusMapping[trackingResult.status] || orderData.order_status_id;
      
      if (newStatusId !== orderData.order_status_id) {
        await ClickPostOrder.updateOrderStatus(orderData.ipshopy_order_id, newStatusId);
        
        // Also update main order table
        await Order.update(
          { order_status_id: newStatusId },
          { where: { order_id: orderData.ipshopy_order_id } }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Order tracking successful',
      data: {
        awb: orderData.waybill,
        order_id: orderData.ipshopy_order_id,
        courier_name: orderData.courier_name,
        courier_partner_id: orderData.courier_partner_id,
        current_status: trackingResult.status,
        status_code: trackingResult.statusCode,
        tracking_history: trackingResult.history || [],
        reference_number: orderData.reference_number,
        label_url: orderData.label_url,
        commercial_invoice_url: orderData.commercial_invoice_url
      }
    });

  } catch (error) {
    console.error('Order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking order'
    });
  }
};

/**
 * Get order tracking history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTrackingHistory = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get order details from database
    const orderData = await ClickPostOrder.getOrderById(orderId);
    
    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not shipped yet'
      });
    }

    if (!orderData.waybill) {
      return res.status(400).json({
        success: false,
        message: 'AWB number not available for this order'
      });
    }

    // Get courier partner ID
    const cpId = orderData.courier_partner_id;
    if (!cpId) {
      return res.status(400).json({
        success: false,
        message: 'Courier partner information not available for this order'
      });
    }

    // Track order via ClickPost API
    const trackingResult = await ClickPostService.trackOrder(orderData.waybill, cpId);

    if (!trackingResult.success) {
      return res.status(400).json({
        success: false,
        message: trackingResult.error || 'Unable to get tracking history at this time'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tracking history retrieved successfully',
      data: {
        awb: orderData.waybill,
        order_id: orderData.ipshopy_order_id,
        courier_name: orderData.courier_name,
        current_status: trackingResult.status,
        tracking_history: trackingResult.history || []
      }
    });

  } catch (error) {
    console.error('Tracking history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving tracking history'
    });
  }
};
