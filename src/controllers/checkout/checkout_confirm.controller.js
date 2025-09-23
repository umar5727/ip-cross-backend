/**
 * Checkout Confirmation Controller
 * Handles the checkout confirmation process
 */

const db = require('../../../config/database');
const orderModel = require('../../models/checkout/order.model');
const { validationResult } = require('express-validator');
const Address = require('../../models/customer/address.model');
const Cart = require('../../models/cart/cart.model');

/**
 * Process checkout confirmation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.confirmCheckout = async (req, res) => {
  // Validate request data
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Start a transaction
  const transaction = await db.transaction();

  try {
    // Extract checkout data from request
    const {
      payment_method,
      comment,
      agree_terms,
      address_id,
      alternate_mobile_number,
      'gst-no': gstNo
    } = req.body;
    
    // Get customer_id from authenticated user
    const customer_id = req.user.customer_id;
    
    // Validate required fields
    const requiredFields = ['payment_method', 'agree_terms'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Validate agreement to terms
    if (!agree_terms) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'You must agree to the terms and conditions'
      });
    }

    // 1. Validate authentication
    if (!req.user || !req.user.customer_id) {
      throw new Error('Authentication failed. Please login again.');
    }

    // 2. Get customer's default address if no address_id provided
    let shipping_address;
    if (!address_id) {
      const defaultAddress = await Address.getDefaultAddress(customer_id);
      if (!defaultAddress) {
        throw new Error('No default address found for customer');
      }
      shipping_address = defaultAddress;
    } else {
      // Get address from address_id
      const addressById = await Address.getAddress(address_id, customer_id);
      if (!addressById) {
        throw new Error('Address not found');
      }
      shipping_address = addressById;
    }

    // Use shipping address as payment address as well
    const payment_address = shipping_address;

    // 3. Get cart items
    const cartData = await Cart.getCart(customer_id);
    if (!cartData || !cartData.products || !cartData.products.length) {
      throw new Error('Your cart is empty');
    }

    // 4. Process checkout logic here...
    // This would include creating orders, processing payment, etc.

    // Commit the transaction
    await transaction.commit();
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Order placed successfully'
    });
    
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during checkout'
    });
  }
};