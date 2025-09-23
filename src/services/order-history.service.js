const sequelize = require('../../config/database');
const OrderHistory = require('../models/order_history');
const Order = require('../models/order/order.model');
const ProductModel = require('../models/product/product.model');
const ProductOptionValueModel = require('../models/product/product_option_value.model');

/**
 * Service to handle order history operations
 */
class OrderHistoryService {
  /**
   * Add a new order history record and update order status
   * 
   * @param {number} orderId - The order ID
   * @param {number} orderStatusId - The new order status ID
   * @param {string} comment - Optional comment for the status change
   * @param {boolean} notify - Whether to notify the customer
   * @param {boolean} override - Whether to override fraud checks
   * @returns {Promise<Object>} - Result of the operation
   */
  async addOrderHistory(orderId, orderStatusId, comment = '', notify = false, override = false) {
    const transaction = await sequelize.transaction();
    
    try {
      // Get order information
      const order = await Order.findByPk(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Create order history record
      await OrderHistory.create({
        order_id: orderId,
        order_status_id: orderStatusId,
        comment: comment,
        notify: notify,
        date_added: new Date()
      }, { transaction });
      
      // Update order status
      await Order.update(
        { 
          order_status_id: orderStatusId,
          date_modified: new Date()
        },
        { 
          where: { order_id: orderId },
          transaction
        }
      );
      
      // If order status is changing to processing or complete status
      // Handle stock subtraction
      const processingOrComplete = [3, 5]; // Example status IDs for processing and complete
      const previousStatus = order.order_status_id;
      
      if (!processingOrComplete.includes(previousStatus) && processingOrComplete.includes(orderStatusId)) {
        // Get order products
        const orderProducts = await sequelize.query(
          `SELECT * FROM order_product WHERE order_id = ?`,
          { 
            replacements: [orderId],
            type: sequelize.QueryTypes.SELECT,
            transaction
          }
        );
        
        // Update product stock
        for (const product of orderProducts) {
          // Update main product stock
          await ProductModel.update(
            { 
              quantity: sequelize.literal(`quantity - ${product.quantity}`) 
            },
            { 
              where: { 
                product_id: product.product_id,
                subtract: 1
              },
              transaction
            }
          );
          
          // Get order options
          const orderOptions = await sequelize.query(
            `SELECT * FROM order_option WHERE order_id = ? AND order_product_id = ?`,
            { 
              replacements: [orderId, product.order_product_id],
              type: sequelize.QueryTypes.SELECT,
              transaction
            }
          );
          
          // Update option values stock
          for (const option of orderOptions) {
            if (option.product_option_value_id) {
              await ProductOptionValueModel.update(
                { 
                  quantity: sequelize.literal(`quantity - ${product.quantity}`) 
                },
                { 
                  where: { 
                    product_option_value_id: option.product_option_value_id,
                    subtract: 1
                  },
                  transaction
                }
              );
            }
          }
        }
      }
      
      await transaction.commit();
      
      return {
        success: true,
        message: 'Order history added successfully'
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new OrderHistoryService();