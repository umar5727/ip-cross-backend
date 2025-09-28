const orderHistoryService = require('../../services/order-history.service');

/**
 * Controller for order history operations
 */
class OrderHistoryController {
  /**
   * Add order history and update order status
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addOrderHistory(req, res) {
    try {
      const { order_id, order_status_id, comment, notify } = req.body;
      
      if (!order_id || !order_status_id) {
        return res.status(400).json({
          success: false,
          message: 'Order ID and order status ID are required'
        });
      }
      
      const result = await orderHistoryService.addOrderHistory(
        order_id,
        order_status_id,
        comment || '',
        notify || false,
        false // override
      );
      
      return res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        error: error.message
      });
    }
  }
}

module.exports = new OrderHistoryController();