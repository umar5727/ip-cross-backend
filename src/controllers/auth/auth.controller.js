const jwt = require('jsonwebtoken');
const { Customer } = require('../../models');
const { redisClient } = require('../../../config/redis');
const otpService = require('../../services/otp.service');

// Register a new customer
exports.register = async (req, res) => {
  try {
    const { firstname, lastname, email, telephone, password } = req.body;

    // Check if customer already exists by email (check entire database)
    const existingCustomerByEmail = await Customer.findOne({ 
      where: { 
        email: email.toLowerCase().trim() 
      } 
    });
    if (existingCustomerByEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already in use' 
      });
    }

    // Check if customer already exists by telephone (check entire database)
    const existingCustomerByPhone = await Customer.findOne({ 
      where: { 
        telephone: telephone.trim() 
      } 
    });
    if (existingCustomerByPhone) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number already in use' 
      });
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
      { 
        id: customer.customer_id,
        customer_id: customer.customer_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove password from response but keep salt
    const { password: _, ...customerData } = customer.toJSON();

    res.status(201).json({
      success: true,
      token,
      data: customerData
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle Sequelize unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      const message = field === 'email' 
        ? 'Email already in use' 
        : field === 'telephone' 
        ? 'Phone number already in use' 
        : 'This information is already in use';
      
      return res.status(400).json({
        success: false,
        message: message
      });
    }
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      const message = error.errors[0].message;
      return res.status(400).json({
        success: false,
        message: message
      });
    }
    
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
      { id: customer.customer_id, customer_id: customer.customer_id },
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
    
    // Remove password from response but keep salt
    const { password: _, ...customerData } = customer.toJSON();
    
    // Ensure salt is included in the response
    if (!customerData.salt && customer.salt) {
      customerData.salt = customer.salt;
    }
    
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
    
    // Send response with explicit status 200 and salt included
    res.status(200).json({
      success: true,
      token,
      salt: customer.salt, // Explicitly include salt at the top level
      customer: {
        id: customer.customer_id,
        ...customerData
      }
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

// Send OTP for login
exports.sendOTP = async (req, res) => {
  try {
    const { telephone } = req.body;

    // Validate input
    if (!telephone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if customer exists with this phone number (check entire database)
    const customer = await Customer.findOne({ 
      where: { 
        telephone: telephone.trim() 
      } 
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number. Please register first.'
      });
    }

    // Check resend status
    const resendStatus = await otpService.checkResendStatus(telephone);
    if (!resendStatus.canResend) {
      const statusCode = resendStatus.isLocked ? 423 : 429; // 423 for locked, 429 for cooldown
      const message = resendStatus.isLocked 
        ? `Account is temporarily locked due to too many failed attempts. Please try again in ${resendStatus.lockoutRemaining} seconds.`
        : `Please wait ${resendStatus.resendAfter} seconds before requesting another OTP`;
      
      return res.status(statusCode).json({
        success: false,
        message: message,
        code: resendStatus.isLocked ? 'ACCOUNT_LOCKED' : 'RESEND_COOLDOWN',
        canResend: false,
        resendAfter: resendStatus.resendAfter,
        isLocked: resendStatus.isLocked,
        lockoutRemaining: resendStatus.lockoutRemaining
      });
    }

    // Send OTP
    const result = await otpService.sendOTP(telephone);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'OTP sent successfully to your WhatsApp',
        data: {
          phoneNumber: telephone,
          messageId: result.messageId,
          canResend: result.canResend,
          resendAfter: result.resendAfter
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to send OTP',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not send OTP'
    });
  }
};

// Verify OTP and login
exports.verifyOTP = async (req, res) => {
  try {
    const { telephone, otp } = req.body;

    // Validate input
    if (!telephone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    // Verify OTP
    const verificationResult = await otpService.verifyOTP(telephone, otp);

    if (!verificationResult.success) {
      const statusCode = verificationResult.code === 'MAX_ATTEMPTS_EXCEEDED' ? 423 : 400;
      return res.status(statusCode).json({
        success: false,
        message: verificationResult.message,
        code: verificationResult.code,
        remainingAttempts: verificationResult.remainingAttempts,
        lockoutDuration: verificationResult.lockoutDuration
      });
    }

    // Find customer by phone number
    const customer = await Customer.findOne({ 
      where: { 
        telephone: telephone.trim() 
      } 
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number. Please register first.'
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

    // Store token in Redis
    console.log(`Storing OTP login token for customer ID: ${customer.customer_id}`);
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

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: customerData
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not verify OTP'
    });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { telephone } = req.body;

    // Validate input
    if (!telephone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if customer exists with this phone number (check entire database)
    const customer = await Customer.findOne({ 
      where: { 
        telephone: telephone.trim() 
      } 
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number. Please register first.'
      });
    }

    // Resend OTP
    const result = await otpService.resendOTP(telephone);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'OTP resent successfully to your WhatsApp',
        data: {
          phoneNumber: telephone,
          messageId: result.messageId,
          canResend: result.canResend,
          resendAfter: result.resendAfter
        }
      });
    } else {
      const statusCode = result.code === 'ACCOUNT_LOCKED' ? 423 : 400;
      res.status(statusCode).json({
        success: false,
        message: result.message || 'Failed to resend OTP',
        code: result.code,
        canResend: result.canResend,
        resendAfter: result.resendAfter,
        isLocked: result.code === 'ACCOUNT_LOCKED',
        lockoutRemaining: result.lockoutRemaining,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not resend OTP'
    });
  }
};

// Send OTP for registration
exports.sendRegistrationOTP = async (req, res) => {
  try {
    const { telephone } = req.body;

    // Validate input
    if (!telephone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if customer already exists with this phone number (check entire database)
    const existingCustomer = await Customer.findOne({ 
      where: { 
        telephone: telephone.trim() 
      } 
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account with this phone number already exists. Please use login instead.'
      });
    }

    // Check resend status
    const resendStatus = await otpService.checkResendStatus(telephone);
    if (!resendStatus.canResend) {
      const statusCode = resendStatus.isLocked ? 423 : 429; // 423 for locked, 429 for cooldown
      const message = resendStatus.isLocked 
        ? `Account is temporarily locked due to too many failed attempts. Please try again in ${resendStatus.lockoutRemaining} seconds.`
        : `Please wait ${resendStatus.resendAfter} seconds before requesting another OTP`;
      
      return res.status(statusCode).json({
        success: false,
        message: message,
        code: resendStatus.isLocked ? 'ACCOUNT_LOCKED' : 'RESEND_COOLDOWN',
        canResend: false,
        resendAfter: resendStatus.resendAfter,
        isLocked: resendStatus.isLocked,
        lockoutRemaining: resendStatus.lockoutRemaining
      });
    }

    // Send OTP
    const result = await otpService.sendOTP(telephone);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'OTP sent successfully to your WhatsApp for registration',
        data: {
          phoneNumber: telephone,
          messageId: result.messageId,
          canResend: result.canResend,
          resendAfter: result.resendAfter
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to send OTP',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not send OTP'
    });
  }
};

// Verify OTP and complete registration
exports.verifyRegistrationOTP = async (req, res) => {
  try {
    const { telephone, otp, firstname, lastname, email, password } = req.body;

    // Validate input
    if (!telephone || !otp || !firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, OTP, name, email, and password are required'
      });
    }

    // Verify OTP
    const verificationResult = await otpService.verifyOTP(telephone, otp);

    if (!verificationResult.success) {
      const statusCode = verificationResult.code === 'MAX_ATTEMPTS_EXCEEDED' ? 423 : 400;
      return res.status(statusCode).json({
        success: false,
        message: verificationResult.message,
        code: verificationResult.code,
        remainingAttempts: verificationResult.remainingAttempts,
        lockoutDuration: verificationResult.lockoutDuration
      });
    }

    // Check if customer already exists by email (check entire database)
    const existingCustomerByEmail = await Customer.findOne({ 
      where: { 
        email: email.toLowerCase().trim() 
      } 
    });
    if (existingCustomerByEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already in use' 
      });
    }

    // Check if customer already exists by telephone (double check entire database)
    const existingCustomerByPhone = await Customer.findOne({ 
      where: { 
        telephone: telephone.trim() 
      } 
    });
    if (existingCustomerByPhone) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number already in use' 
      });
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
      { 
        id: customer.customer_id,
        customer_id: customer.customer_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Store token in Redis
    console.log(`Storing registration token for customer ID: ${customer.customer_id}`);
    try {
      redisClient.set(`auth_${customer.customer_id}`, token, 'EX', 86400);
    } catch (redisError) {
      console.error('Redis error (non-blocking):', redisError);
    }

    // Remove password from response
    const { password: _, ...customerData } = customer.toJSON();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      data: customerData
    });
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    
    // Handle Sequelize unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      const message = field === 'email' 
        ? 'Email already in use' 
        : field === 'telephone' 
        ? 'Phone number already in use' 
        : 'This information is already in use';
      
      return res.status(400).json({
        success: false,
        message: message
      });
    }
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      const message = error.errors[0].message;
      return res.status(400).json({
        success: false,
        message: message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Could not complete registration'
    });
  }
};

// Get OTP status (resend availability)
exports.getOTPStatus = async (req, res) => {
  try {
    const { telephone } = req.params;

    if (!telephone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const resendStatus = await otpService.checkResendStatus(telephone);
    const hasActiveOTP = await otpService.hasActiveOTP(telephone);

    res.status(200).json({
      success: true,
      data: {
        phoneNumber: telephone,
        hasActiveOTP: hasActiveOTP,
        canResend: resendStatus.canResend,
        resendAfter: resendStatus.resendAfter,
        isLocked: resendStatus.isLocked,
        lockoutRemaining: resendStatus.lockoutRemaining
      }
    });
  } catch (error) {
    console.error('Get OTP status error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get OTP status'
    });
  }
};