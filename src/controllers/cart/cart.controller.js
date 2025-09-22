const { Op } = require('sequelize');
const { Product, Cart, ProductDescription } = require('../../models');
const sequelize = require('../../../config/database');
const cache = require('../../middleware/cache');

// Get cart contents
exports.getCart = [
  cache(60), // Cache for 1 minute
  async (req, res) => {
    try {
      // Use session ID from query params
      const sessionId = req.query.session_id;
      
      // Extract customer ID from authenticated user
      const customerId = req.user ? req.user.customer_id : 0;
      const languageId = parseInt(req.query.language_id) || 1;
      
      console.log('Getting cart with sessionId:', sessionId);
      console.log('Customer ID:', customerId);

      // Build where clause based on available parameters
      let whereClause = {};
      
      if (sessionId) {
        whereClause = { session_id: sessionId };
      } else if (customerId > 0) {
        whereClause = { customer_id: customerId };
      } else {
        return res.json({
          success: true,
          data: {
            products: [],
            total: 0,
            count: 0
          }
        });
      }
      
      console.log('Where clause for cart query:', JSON.stringify(whereClause));
      
      // Get cart items using Sequelize
      const cartItems = await Cart.findAll({ where: whereClause });
      
      console.log('Cart items found with Sequelize:', cartItems.length);

      if (!cartItems.length) {
        return res.json({
          success: true,
          data: {
            products: [],
            total: 0,
            total_items: 0
          }
        });
      }

      // Get product details for cart items
      const productIds = cartItems.map(item => item.product_id);
      
      const products = await Product.findAll({
        where: {
          product_id: { [Op.in]: productIds },
          status: true
        },
        include: [
          {
            model: ProductDescription,
            where: { language_id: languageId },
            attributes: ['name', 'description']
          },
          {
            model: sequelize.models.product_special,
            required: false,
            where: {
              customer_group_id: 1, // Default customer group
              date_start: { [Op.lte]: new Date() },
              date_end: { 
                [Op.or]: [
                  { [Op.gte]: new Date() },
                  { [Op.eq]: '0000-00-00' }
                ]
              }
            },
            order: [['priority', 'ASC']],
            limit: 1
          }
        ]
      });

      // Map products to cart items with quantity
      const cartProducts = cartItems.map(cartItem => {
        const product = products.find(p => p.product_id === cartItem.product_id);
        if (!product) return null;

        // Get the special price if available
        const specialPrice = product.product_specials && product.product_specials.length > 0 
          ? parseFloat(product.product_specials[0].price) 
          : null;
        
        // Use special price if available, otherwise use regular price
        const finalPrice = specialPrice !== null ? specialPrice : parseFloat(product.price);

        return {
          cart_id: cartItem.cart_id,
          product_id: product.product_id,
          name: product.product_descriptions ? product.product_descriptions.name : product.model || `Product ${product.product_id}`,
          model: product.model,
          image: product.image,
          quantity: cartItem.quantity,
          mrp: parseFloat(product.price),
          price: finalPrice,
          total: finalPrice * cartItem.quantity
        };
      }).filter(Boolean);

      // Calculate totals
      const totalItems = cartProducts.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = cartProducts.reduce((sum, item) => sum + item.total, 0);

      return res.json({
        success: true,
        data: {
          products: cartProducts,
          total: totalPrice,
          total_items: totalItems
        }
      });
    } catch (error) {
      console.error('Error getting cart:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving cart',
        error: error.message
      });
    }
  }
];

// Add product to cart
exports.addToCart = async (req, res) => {
  try {
    const { product_id, quantity = 1, options = {}, session_id } = req.body;
    
    // Get customer ID if user is logged in
    const customerId = req.user ? req.user.customer_id : 0;
    
    // Use session_id from request body if provided, otherwise generate a new one
    let sessionId = session_id;
    if (!sessionId) {
      // Generate a clean session ID (timestamp only)
      sessionId = Date.now().toString();
    }
    
    console.log('Adding to cart - Session ID:', sessionId);
    console.log('Adding to cart - Customer ID:', customerId);
    console.log('Adding to cart - Product ID:', product_id);
    
    // Validate product exists
    const product = await Product.findByPk(product_id);
    if (!product || !product.status) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable'
      });
    }

    // Check if product already in cart
    const existingCartItem = await Cart.findOne({
      where: {
        product_id,
        [Op.or]: [
          { session_id: sessionId, customer_id: 0 },
          { customer_id: customerId }
        ],
        option: JSON.stringify(options)
      }
    });

    if (existingCartItem) {
      // Update quantity
      await existingCartItem.update({
        quantity: existingCartItem.quantity + quantity
      });
    } else {
      // Add new item
      await Cart.create({
        customer_id: customerId,
        session_id: sessionId,
        product_id,
        quantity,
        option: JSON.stringify(options),
        date_added: new Date()
      });
    }

    return res.json({
      success: true,
      message: 'Product added to cart'
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding product to cart',
      error: error.message
    });
  }
};

// Update cart item
exports.updateCart = async (req, res) => {
  try {
    console.log('Update cart request body:', req.body);
    const { product_id, quantity } = req.body;
    const sessionId = req.session_id;
    const customerId = req.user ? req.user.customer_id : 0;
    console.log('Update cart - Customer ID:', customerId, 'Product ID:', product_id);

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Create where clause
    const whereClause = {
      product_id
    };
    
    // Add session or customer condition
    if (customerId > 0) {
      whereClause.customer_id = customerId;
    } else {
      whereClause.session_id = sessionId;
    }

    // Find cart item
    const cartItem = await Cart.findOne({
      where: whereClause
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    if (quantity > 0) {
      // Update quantity
      await cartItem.update({ quantity });
    } else {
      // Remove item if quantity is 0 or negative
      await cartItem.destroy();
    }

    return res.json({
      success: true,
      message: quantity > 0 ? 'Cart updated' : 'Item removed from cart'
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating cart',
      error: error.message
    });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  try {
    const { cart_id } = req.params;
    const sessionId = req.session.id;
    const customerId = req.user ? req.user.customer_id : 0;

    // Find and delete cart item
    const result = await Cart.destroy({
      where: {
        cart_id,
        [Op.or]: [
          { session_id: sessionId, customer_id: 0 },
          { customer_id: customerId, customer_id: { [Op.gt]: 0 } }
        ]
      }
    });

    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    return res.json({
      success: true,
      message: 'Item removed from cart'
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing item from cart',
      error: error.message
    });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const sessionId = req.session ? req.session.id : `session_${Date.now()}`;
    const customerId = req.user ? req.user.customer_id : 0;
    
    console.log('Clear cart - Session ID:', sessionId);
    console.log('Clear cart - Customer ID:', customerId);

    // Delete all cart items for this customer/session
    await Cart.destroy({
      where: {
        [Op.or]: [
          { session_id: sessionId, customer_id: 0 },
          { customer_id: customerId, customer_id: { [Op.gt]: 0 } }
        ]
      }
    });

    return res.json({
      success: true,
      message: 'Cart cleared'
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
};