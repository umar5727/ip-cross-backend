const jwt = require('jsonwebtoken');
const { Customer } = require('../models');
const { redisClient } = require('../../config/redis');

// Optional authentication middleware for cart routes
// Allows both authenticated and guest users to access cart functionality
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, proceed as guest user
    if (!token) {
      console.log('No token provided, proceeding as guest user');
      next();
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get customer ID from decoded token (support both formats)
      const customerId = decoded.customer_id || decoded.id;
      console.log('Token decoded, customer_id:', customerId);

      if (!customerId) {
        console.log('No customer_id in token, proceeding as guest user');
        next();
        return;
      }

      // Get customer from database
      const customer = await Customer.findByPk(customerId, {
        attributes: { exclude: ['password', 'salt'] }
      });

      // Check if customer exists
      if (!customer) {
        // Proceed as guest if customer not found
        console.log('Customer not found, proceeding as guest user');
        next();
        return;
      }

      // Check if customer is active
      if (!customer.status) {
        // Proceed as guest if customer is inactive
        console.log('Customer account is disabled, proceeding as guest user');
        next();
        return;
      }

      // Add customer to request object
      req.customer = customer;
      
      // IMPORTANT: Set req.user with customer_id for compatibility with cart controller
      req.user = {
        customer_id: customer.customer_id
      };
      
      console.log('User authenticated with customer_id:', customer.customer_id);
      next();
    } catch (error) {
      // If token verification fails, proceed as guest
      console.log('Token verification failed, proceeding as guest user:', error.message);
      next();
    }
  } catch (error) {
    console.error('Guest cart middleware error:', error);
    // Even on error, allow access as guest
    next();
  }
};