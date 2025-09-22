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
        // Check if token is blacklisted - this applies to all routes except logout
        try {
          const isBlacklisted = await new Promise((resolve, reject) => {
            redisClient.get(`blacklist_${token}`, (err, result) => {
              if (err) {
                console.error('Redis blacklist check error:', err);
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          
          if (isBlacklisted) {
            console.log(`Token is blacklisted (previously logged out)`);
            
            // If this is a login request, allow it to proceed
            if (req.originalUrl.includes('/api/auth/login')) {
              console.log('Login route detected - allowing despite blacklisted token');
              next();
              return;
            }
            
            return res.status(401).json({
              success: false,
              message: 'Already logged out'
            });
          }
        } catch (redisError) {
          console.error('Redis error during blacklist check:', redisError);
          // Continue with the request even if Redis check fails
          console.log('Continuing despite Redis error');
        }
      }

      // For logout route or cart routes, we'll skip the Redis token validation
      if (req.originalUrl.includes('/api/auth/logout') || req.originalUrl.includes('/api/cart')) {
        console.log(`${req.originalUrl} route detected - skipping Redis token validation`);
      } else {
        // For all other protected routes, validate the token
        try {
          console.log(`Checking token for customer ID: ${decoded.id}`);
          console.log(`Token from request: ${token}`);
          
          const redisToken = await new Promise((resolve, reject) => {
            redisClient.get(`auth_${decoded.id}`, (err, result) => {
              if (err) {
                console.error('Redis token check error:', err);
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          
          console.log(`Token from Redis: ${redisToken}`);
          
          if (!redisToken) {
            console.log(`No token found in Redis for customer ID: ${decoded.id}`);
            return res.status(401).json({
              success: false,
              message: 'Token is invalid or expired'
            });
          }
          
          if (redisToken !== token) {
            console.log(`Token mismatch: Redis token does not match request token`);
            return res.status(401).json({
              success: false,
              message: 'Token is invalid or expired'
            });
          }
        } catch (redisError) {
          console.error('Redis error during token validation:', redisError);
          // Continue with the request even if Redis check fails
          console.log('Continuing despite Redis error');
        }
      }

      // Get customer from database
      const customer = await Customer.findByPk(decoded.id, {
        attributes: { exclude: ['password', 'salt'] }
      });

      // Check if customer exists
      if (!customer) {
        return res.status(401).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Check if customer is active
      if (!customer.status) {
        return res.status(401).json({
          success: false,
          message: 'Your account is disabled'
        });
      }

      // Add customer to request object
      req.customer = customer;
      // Also set req.user with customer_id for compatibility with cart controller
      req.user = {
        customer_id: customer.customer_id
      };
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};