const jwt = require('jsonwebtoken');
const { Customer } = require('../../models');
const { redisClient } = require('../../../config/redis');

// Register a new customer
exports.register = async (req, res) => {
  try {
    const { firstname, lastname, email, telephone, password } = req.body;

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ where: { email } });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Create new customer
    const customer = await Customer.create({
      customer_group_id: 1, // Default customer group
      firstname,
      lastname,
      email,
      telephone,
      password,
      ip: req.ip,
      status: true,
      approved: true,
      safe: true,
      date_added: new Date()
    });

    // Generate token
    const token = jwt.sign(
      { id: customer.customer_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove password from response
    const { password: _, ...customerData } = customer.toJSON();

    res.status(201).json({
      success: true,
      token,
      data: customerData
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not register customer'
    });
  }
};

// Login customer
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if email and password are provided
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Check if customer exists
    const customer = await Customer.findOne({ 
      where: { 
        email: email.toLowerCase().trim() 
      } 
    });
    
    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if password is correct
    try {
      const isPasswordValid = await customer.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
    } catch (passwordError) {
      console.error('Password comparison error:', passwordError);
      return res.status(500).json({
        success: false,
        message: 'Error validating credentials'
      });
    }

    // Check if customer is active
    if (!customer.status) {
      return res.status(401).json({
        success: false,
        message: 'Your account is disabled'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: customer.customer_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Store new token in Redis (simplified approach)
    console.log(`Storing token for customer ID: ${customer.customer_id}`);
    try {
      redisClient.set(`auth_${customer.customer_id}`, token, 'EX', 86400);
    } catch (redisError) {
      console.error('Redis error (non-blocking):', redisError);
    }
    
    // Remove password from response
    const { password: _, ...customerData } = customer.toJSON();
    
    // Transfer guest cart items to customer account if session_id is provided
    if (req.body.session_id) {
      try {
        const { Cart } = require('../../models');
        const sessionId = req.body.session_id;
        
        console.log(`Transferring cart items from session ${sessionId} to customer ${customer.customer_id}`);
        
        // Find all cart items with this session_id and customer_id = 0 (guest)
        const guestCartItems = await Cart.findAll({
          where: {
            session_id: sessionId,
            customer_id: 0
          }
        });
        
        console.log(`Found ${guestCartItems.length} guest cart items to transfer`);
        
        // For each guest cart item
        for (const item of guestCartItems) {
          // Check if customer already has this product in cart
          const existingItem = await Cart.findOne({
            where: {
              customer_id: customer.customer_id,
              product_id: item.product_id,
              option: item.option
            }
          });
          
          if (existingItem) {
            // Update quantity of existing item
            console.log(`Updating existing cart item for product ${item.product_id}`);
            await existingItem.update({
              quantity: existingItem.quantity + item.quantity
            });
            
            // Remove the guest cart item
            await item.destroy();
          } else {
            // Update the guest cart item to belong to the customer
            console.log(`Transferring cart item for product ${item.product_id}`);
            await item.update({
              customer_id: customer.customer_id
            });
          }
        }
        
        console.log('Cart transfer completed successfully');
      } catch (cartError) {
        console.error('Error transferring cart:', cartError);
        // Don't fail the login if cart transfer fails
      }
    }
    
    // Send response
    res.status(200).json({
      success: true,
      token,
      data: customerData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not log in'
    });
  }
};

// Logout customer
exports.logout = async (req, res) => {
  try {
    console.log('Logout request received');
    
    // Get token from authorization header
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return res.status(401).json({
        success: false,
        message: 'No valid token provided'
      });
    }
    
    const token = req.headers.authorization.split(' ')[1];
    
    // Check if token is already blacklisted FIRST
    redisClient.get(`blacklist_${token}`, function(err, isBlacklisted) {
      if (err) {
        console.error('Redis blacklist check error:', err);
        // Continue with logout even if Redis check fails
      }
      
      // If token is blacklisted but we're still getting "Token is blacklisted" in auth middleware,
      // let's allow the logout to proceed anyway to fix the user's state
      if (isBlacklisted) {
        console.log('Token was previously invalidated, but allowing logout to proceed');
      }
      
      // Verify the token is valid before proceeding
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token verified for customer ID:', decoded.id);
        
        // Add token to blacklist
        redisClient.set(`blacklist_${token}`, 'invalidated');
        redisClient.expire(`blacklist_${token}`, 86400);
        
        // Remove token from auth storage
        console.log(`Removing auth token for customer ID: ${decoded.id}`);
        redisClient.del(`auth_${decoded.id}`);
        
        // Remove token from Redis if customer exists in request
        if (req.customer) {
          console.log(`Customer in request: ${req.customer.customer_id}`);
          console.log(`Checking token for customer ID: ${req.customer.customer_id}`);
          
          // This is a backup in case decoded.id is different from req.customer.customer_id
          redisClient.del(`auth_${req.customer.customer_id}`);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Logged out successfully'
        });
      } catch (error) {
        console.log('Invalid token provided:', error.message);
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not log out'
    });
  }
};

// Get current customer profile
exports.getProfile = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.customer.customer_id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Remove password from response
    const { password: _, ...customerData } = customer.toJSON();

    res.status(200).json({
      success: true,
      data: customerData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get profile'
    });
  }
};