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

      // Get customer from database
      const customer = await Customer.findByPk(decoded.id, {
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
      // Also set req.user with customer_id for compatibility with cart controller
      req.user = {
        customer_id: customer.customer_id
      };
      next();
    } catch (error) {
      // If token verification fails, proceed as guest
      console.log('Token verification failed, proceeding as guest user');
      next();
    }
  } catch (error) {
    console.error('Guest cart middleware error:', error);
    // Even on error, allow access as guest
    next();
  }
};