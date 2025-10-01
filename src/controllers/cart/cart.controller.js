const { Op } = require('sequelize');
const { Product, Cart, ProductDescription, ProductDiscount } = require('../../models');
const sequelize = require('../../../config/database');
const { resizeImage } = require('../../utils/image');

// Get cart contents
exports.getCart = async (req, res) => {
  try {
    // Log the incoming token for debugging
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader);
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('Extracted token:', token);
    }
    
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
    console.log('Product IDs to fetch:', productIds);
    
    const products = await Product.findAll({
      where: {
        product_id: { [Op.in]: productIds }
        // Removed status filter to show all products regardless of status
      },
      include: [
        {
          model: ProductDescription,
          as: 'product_description',
          where: { language_id: languageId },
          attributes: ['name', 'description']
        },
        {
          model: sequelize.models.product_special,
          as: 'ProductSpecials',
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
    
    console.log('Products found:', products.length, 'out of', productIds.length, 'requested');

    // Map products to cart items with quantity
    const cartProducts = cartItems.map(cartItem => {
      const product = products.find(p => p.product_id === cartItem.product_id);
      if (!product) return null;

      // Get the special price if available
      const specialPrice = product.ProductSpecials && product.ProductSpecials.length > 0 
        ? parseFloat(product.ProductSpecials[0].price) 
        : null;
      
      // Check for applicable discount based on quantity
      let discountPrice = null;
      if (product.product_discounts && product.product_discounts.length > 0) {
        // Find discount where cart quantity is between min and max thresholds (inclusive)
        const applicableDiscount = product.product_discounts.find(discount => {
          const minQuantity = parseInt(discount.quantity) || 1;
          const maxQuantity = parseInt(discount.max_quantity) || 999999;
          return cartItem.quantity >= minQuantity && cartItem.quantity <= maxQuantity;
        });
        
        if (applicableDiscount) {
          discountPrice = parseFloat(applicableDiscount.price);
        }
      }
      
      // Apply price hierarchy: discount > special > regular price
      let finalPrice;
      if (discountPrice !== null) {
        finalPrice = discountPrice;
      } else if (specialPrice !== null) {
        finalPrice = specialPrice;
      } else {
        finalPrice = parseFloat(product.price);
      }

      // Debug: Check product_description structure
      console.log(`Product ${product.product_id} description:`, {
        has_description: !!product.product_description,
        is_array: Array.isArray(product.product_description),
        length: product.product_description ? product.product_description.length : 0,
        first_item: product.product_description && product.product_description[0] ? product.product_description[0].name : 'N/A'
      });
      
      // Get product name from product_description (it's an array due to hasMany association)
      const productName = (product.product_description && product.product_description.length > 0) 
        ? product.product_description[0].name 
        : product.model || `Product ${product.product_id}`;
      
      // Resize image to 200x200 for cart display
      const resizedImage = resizeImage(product.image, 200, 200, true);

      return {
        cart_id: cartItem.cart_id,
        product_id: product.product_id,
        name: productName,
        model: product.model,
        image: resizedImage,
        quantity: cartItem.quantity,
        mrp: parseFloat(product.price),
        price: finalPrice,
        total: finalPrice * cartItem.quantity,
        _shipping: product.shipping || 0 // Internal flag for courier charges calculation
      };
    }).filter(Boolean);

    // Calculate totals
    const totalItems = cartProducts.reduce((sum, item) => sum + parseInt(item.quantity), 0);
    const totalPrice = cartProducts.reduce((sum, item) => sum + item.total, 0);
    const productCount = cartProducts.length;
    
    // Calculate courier charges if user is authenticated
    let courierCharges = 0;
    if (customerId > 0) {
      // Apply courier charge logic: only if total < 500 and at least one product has shipping enabled
      const hasShippingProduct = cartProducts.some(item => item._shipping === 1 || item._shipping === true);
      if (totalPrice < 500 && hasShippingProduct) {
        courierCharges = 50;
      }
    }
    
    // Remove internal shipping flag from response
    cartProducts.forEach(item => delete item._shipping);

    // Prepare response data
    const responseData = {
      products: cartProducts,
      total: totalPrice,
      total_items: totalItems,
      product_count: productCount
    };
    
    // Add courier charges only for authenticated users
    if (customerId > 0) {
      responseData.courier_charges = courierCharges;
      responseData.grand_total = totalPrice + courierCharges;
    }
    
    return res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving cart',
      error: error.message
    });
  }
};

// Add product to cart
exports.addToCart = async (req, res) => {
  try {
    const { product_id, quantity = 1, session_id } = req.body;
    
    // Get customer ID if user is logged in
    const customerId = req.user ? req.user.customer_id : 0;
    
    // Use session_id from request body if provided, otherwise generate a new one
    let sessionId = session_id;
    if (!sessionId) {
      // Generate a clean session ID (timestamp + random string)
      sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
    }
    
    console.log('Adding to cart - Session ID:', sessionId);
    console.log('Adding to cart - Customer ID:', customerId);
    console.log('Adding to cart - Product ID:', product_id);
    
    // Validate product exists and is active
    const product = await Product.findByPk(product_id);
    if (!product || !product.status) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable'
      });
    }

    // Check if product already in cart - with proper session ID handling
    let whereClause = { product_id };
    
    if (customerId > 0) {
      // For logged-in users, find by customer ID
      whereClause.customer_id = customerId;
    } else {
      // For guest users, find by exact session ID
      whereClause.session_id = sessionId;
      whereClause.customer_id = 0;
    }
    
    const existingCartItem = await Cart.findOne({ where: whereClause });

    if (existingCartItem) {
      // Update quantity
      await existingCartItem.update({
        quantity: parseInt(existingCartItem.quantity) + parseInt(quantity)
      });
    } else {
      // Add new item
      await Cart.create({
        customer_id: customerId,
        session_id: sessionId,
        product_id,
        quantity,
        date_added: new Date()
      });
    }

    return res.json({
      success: true,
      message: 'Product added to cart',
      session_id: sessionId
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
    const { product_id, quantity, session_id } = req.body;
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
    } else if (session_id) {
      whereClause.session_id = session_id;
      whereClause.customer_id = 0;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Session ID or authentication is required'
      });
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
    const { product_id } = req.body;
    const sessionId = req.body.session_id || req.query.session_id;
    const customerId = req.user ? req.user.customer_id : 0;
    
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Build where clause based on available identifiers
    const whereClause = { product_id };
    
    if (customerId > 0) {
      whereClause.customer_id = customerId;
    } else if (sessionId) {
      whereClause.session_id = sessionId;
      whereClause.customer_id = 0;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Session ID or authentication is required'
      });
    }

    console.log('Removing product from cart:', whereClause);

    // Find and delete cart item
    const result = await Cart.destroy({ where: whereClause });

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
    const sessionId = req.body.session_id || req.query.session_id;
    const customerId = req.user ? req.user.customer_id : 0;
    
    console.log('Clear cart - Session ID:', sessionId);
    console.log('Clear cart - Customer ID:', customerId);

    // Build where clause based on available identifiers
    let whereClause = {};
    
    if (customerId > 0) {
      whereClause.customer_id = customerId;
    } else if (sessionId) {
      whereClause.session_id = sessionId;
      whereClause.customer_id = 0;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Session ID or authentication is required'
      });
    }

    // Delete all cart items for this customer/session
    await Cart.destroy({ where: whereClause });

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

// Transfer guest cart to user account after login
exports.transferGuestCart = async (req, res) => {
  try {
    const { session_id } = req.body;
    const customerId = req.user.customer_id;
    
    if (!session_id || !customerId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and customer ID are required'
      });
    }
    
    console.log(`Transferring cart from session ${session_id} to customer ${customerId}`);
    
    // Get guest cart items
    const guestCartItems = await Cart.findAll({
      where: {
        session_id,
        customer_id: 0
      }
    });
    
    if (!guestCartItems.length) {
      return res.json({
        success: true,
        message: 'No guest cart items to transfer',
        transferred: 0
      });
    }
    
    // Get user's existing cart items
    const userCartItems = await Cart.findAll({
      where: {
        customer_id: customerId
      }
    });
    
    // Process each guest cart item
    let transferCount = 0;
    for (const guestItem of guestCartItems) {
      // Check if product already exists in user's cart
      const existingItem = userCartItems.find(item => item.product_id === guestItem.product_id);
      
      if (existingItem) {
        // Update quantity if product already in user's cart
        await Cart.update(
          { quantity: existingItem.quantity + guestItem.quantity },
          { where: { cart_id: existingItem.cart_id } }
        );
      } else {
        // Add new item to user's cart
        await Cart.create({
          customer_id: customerId,
          session_id: req.user.session_id || session_id, // Use user's session_id if available, otherwise keep the guest session_id
          product_id: guestItem.product_id,
          quantity: guestItem.quantity,
          date_added: new Date()
        });
      }
      
      // Delete the guest cart item
      await Cart.destroy({
        where: { cart_id: guestItem.cart_id }
      });
      
      transferCount++;
    }
    
    return res.json({
      success: true,
      message: `Successfully transferred ${transferCount} items to your cart`,
      transferred: transferCount
    });
  } catch (error) {
    console.error('Error transferring cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error transferring cart',
      error: error.message
    });
  }
};