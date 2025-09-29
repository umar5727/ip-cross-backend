/**
 * Production Logger Utility
 * Structured logging with different levels and formats
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.metadata && Object.keys(info.metadata).length ? 
      ' ' + JSON.stringify(info.metadata) : ''
    }`
  )
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports array
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat
  })
];

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  transports,
  exitOnError: false
});

// Enhanced logging methods for payment operations
logger.payment = {
  orderCreated: (orderId, razorpayOrderId, amount) => {
    logger.info('Payment order created', {
      event: 'payment_order_created',
      order_id: orderId,
      razorpay_order_id: razorpayOrderId,
      amount,
      timestamp: new Date().toISOString()
    });
  },

  paymentVerified: (paymentId, orderId, status) => {
    logger.info('Payment verified', {
      event: 'payment_verified',
      payment_id: paymentId,
      order_id: orderId,
      status,
      timestamp: new Date().toISOString()
    });
  },

  webhookReceived: (eventType, paymentId) => {
    logger.info('Webhook received', {
      event: 'webhook_received',
      event_type: eventType,
      payment_id: paymentId,
      timestamp: new Date().toISOString()
    });
  },

  refundProcessed: (refundId, paymentId, amount) => {
    logger.info('Refund processed', {
      event: 'refund_processed',
      refund_id: refundId,
      payment_id: paymentId,
      amount,
      timestamp: new Date().toISOString()
    });
  },

  error: (operation, error, metadata = {}) => {
    logger.error(`Payment ${operation} failed`, {
      event: 'payment_error',
      operation,
      error: error.message,
      stack: error.stack,
      ...metadata,
      timestamp: new Date().toISOString()
    });
  }
};

// Security logging methods
logger.security = {
  webhookValidationFailed: (reason, ip) => {
    logger.warn('Webhook validation failed', {
      event: 'webhook_validation_failed',
      reason,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  rateLimitExceeded: (ip, endpoint) => {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      ip,
      endpoint,
      timestamp: new Date().toISOString()
    });
  },

  suspiciousActivity: (activity, metadata = {}) => {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      activity,
      ...metadata,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = logger;