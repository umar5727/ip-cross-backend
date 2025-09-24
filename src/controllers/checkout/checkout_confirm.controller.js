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
      shipping_address_id,
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

    // 2. Get shipping address from shipping_address_id or address_id
    let shipping_address;
    const addressIdToUse = shipping_address_id || address_id;
    
    if (addressIdToUse) {
      // Get address from address_id
      console.log(`Looking for shipping address with ID ${addressIdToUse} for customer ${customer_id}`);
      const addressById = await Address.getAddress(addressIdToUse, customer_id);
      console.log(`Shipping address found by ID: ${addressById ? 'Yes' : 'No'}`);
      
      if (!addressById) {
        throw new Error('Shipping address not found');
      }
      shipping_address = addressById;
    } else {
      throw new Error('No shipping address provided');
    }

    // 3. Get payment address (default address)
    console.log(`Looking for default address for customer ${customer_id} to use as payment address`);
    const defaultAddress = await Address.getDefaultAddress(customer_id);
    console.log(`Default address found for payment: ${defaultAddress ? 'Yes' : 'No'}`);
    
    let payment_address;
    if (!defaultAddress) {
      // Instead of throwing an error, use shipping address as payment address
      console.log('Using shipping address as payment address');
      payment_address = shipping_address;
    } else {
      payment_address = defaultAddress;
    }

    // 3. Get cart items
    const cartItems = await Cart.findAll({
      where: { customer_id }
    });
    
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Your cart is empty');
    }
    
    // Format cart data in the expected structure
    const cartData = {
      products: cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        option: item.option ? JSON.parse(item.option) : {}
      })),
      total_items: cartItems.length
    };

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