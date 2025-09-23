const jwt = require('jsonwebtoken');
const { Customer } = require('../models');
const { redisClient } = require('../../config/redis');

// Protect routes - only authenticated customers can access
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // For logout route, we'll skip the blacklist check
      // This allows users to logout even with a blacklisted token
      if (req.originalUrl.includes('/api/auth/logout')) {
        console.log('Logout route detected - skipping blacklist check');
      } else {
        // Temporarily skip Redis blacklist check to avoid timeouts
        console.log('Skipping Redis blacklist check temporarily');
      }

      // Get customer from database
      const customer = await Customer.findByPk(decoded.id);

      // Check if customer exists
      if (!customer) {
        return res.status(401).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Set customer on request object
      req.customer = customer;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin only middleware
exports.adminOnly = (req, res, next) => {
  if (req.customer && req.customer.customer_group_id === 1) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Admin access required for this route'
    });
  }
};