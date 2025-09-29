/**
 * Security Middleware for Razorpay Integration
 * Implements rate limiting, IP whitelisting, and request validation
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const logger = require('../utils/logger');
const razorpayConfig = require('../config/razorpay.config');

/**
 * Rate limiting for payment endpoints
 */
const paymentRateLimit = rateLimit({
  windowMs: razorpayConfig.getConfig().rate_limit.window_ms,
  max: razorpayConfig.getConfig().rate_limit.max_requests,
  message: {
    error: 'Too many payment requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security.rateLimitExceeded(req.ip, req.originalUrl);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.round(razorpayConfig.getConfig().rate_limit.window_ms / 1000)
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/status';
  }
});

/**
 * Slow down middleware for suspicious activity
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // Allow 5 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  onLimitReached: (req) => {
    logger.security.suspiciousActivity('Speed limit reached', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
  }
});

/**
 * IP Whitelisting for webhook endpoints
 */
const webhookIPWhitelist = (req, res, next) => {
  // Razorpay webhook IP ranges (update as needed)
  const allowedIPs = process.env.RAZORPAY_WEBHOOK_IPS 
    ? process.env.RAZORPAY_WEBHOOK_IPS.split(',')
    : [
        '106.51.16.0/20',
        '103.57.144.0/20'
      ];

  // Skip IP check in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Simple IP check (in production, use a proper IP range checker)
  const isAllowed = allowedIPs.some(ip => {
    if (ip.includes('/')) {
      // CIDR notation - simplified check
      const [network, bits] = ip.split('/');
      return clientIP.startsWith(network.split('.').slice(0, Math.floor(bits / 8)).join('.'));
    }
    return clientIP === ip;
  });

  if (!isAllowed) {
    logger.security.webhookValidationFailed('IP not whitelisted', clientIP);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }

  next();
};

/**
 * Request validation middleware
 */
const validatePaymentRequest = (req, res, next) => {
  const { body } = req;

  // Check for required fields based on endpoint
  if (req.path.includes('/create-order')) {
    if (!body.amount || !body.receipt) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Amount and receipt are required'
      });
    }

    // Validate amount
    if (isNaN(body.amount) || body.amount <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid amount'
      });
    }
  }

  if (req.path.includes('/verify-payment')) {
    const required = ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'];
    const missing = required.filter(field => !body[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }
  }

  next();
};

/**
 * Webhook signature validation middleware
 */
const validateWebhookSignature = (req, res, next) => {
  const signature = req.get('X-Razorpay-Signature');
  const timestamp = req.get('X-Razorpay-Timestamp');
  
  if (!signature) {
    logger.security.webhookValidationFailed('Missing signature header', req.ip);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing webhook signature'
    });
  }

  // Store raw body for signature verification
  req.rawBody = JSON.stringify(req.body);
  req.webhookSignature = signature;
  req.webhookTimestamp = timestamp ? parseInt(timestamp) : null;

  next();
};

/**
 * Security headers middleware
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "api.razorpay.com"],
      frameSrc: ["'self'", "api.razorpay.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Payment API request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Payment API error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
};

module.exports = {
  paymentRateLimit,
  speedLimiter,
  webhookIPWhitelist,
  validatePaymentRequest,
  validateWebhookSignature,
  securityHeaders,
  requestLogger,
  errorHandler
};