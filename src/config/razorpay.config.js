/**
 * Razorpay Configuration
 * Production-ready configuration with proper validation
 */

const logger = require('../utils/logger');

class RazorpayConfig {
  constructor() {
    this.validateEnvironment();
    this.config = {
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
      webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
      currency: process.env.RAZORPAY_CURRENCY || 'INR',
      timeout: parseInt(process.env.RAZORPAY_TIMEOUT) || 30000,
      max_retries: parseInt(process.env.RAZORPAY_MAX_RETRIES) || 3,
      retry_delay: parseInt(process.env.RAZORPAY_RETRY_DELAY) || 1000,
      webhook_tolerance: parseInt(process.env.RAZORPAY_WEBHOOK_TOLERANCE) || 300, // 5 minutes
      rate_limit: {
        window_ms: parseInt(process.env.RAZORPAY_RATE_LIMIT_WINDOW) || 900000, // 15 minutes
        max_requests: parseInt(process.env.RAZORPAY_RATE_LIMIT_MAX) || 100
      }
    };
  }

  validateEnvironment() {
    // Only validate in production or when explicitly required
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_RAZORPAY_CONFIG === 'true') {
      const requiredEnvVars = [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        const error = `Missing required Razorpay environment variables: ${missingVars.join(', ')}`;
        logger.error('Razorpay configuration error', { missingVars });
        throw new Error(error);
      }

      // Validate key format
      if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_')) {
        throw new Error('Invalid Razorpay Key ID format. Must start with "rzp_"');
      }

      // Warn about test keys in production
      if (process.env.NODE_ENV === 'production' && process.env.RAZORPAY_KEY_ID.includes('test')) {
        logger.warn('Using Razorpay test keys in production environment');
      }
    } else {
      // In development, just warn if variables are missing
      const requiredEnvVars = [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        logger.warn('Razorpay environment variables not configured (development mode)', { missingVars });
      }
    }

    logger.info('Razorpay configuration validated successfully');
  }

  getConfig() {
    return { ...this.config };
  }

  getApiCredentials() {
    return {
      key_id: this.config.key_id,
      key_secret: this.config.key_secret
    };
  }

  getWebhookSecret() {
    return this.config.webhook_secret;
  }

  isProduction() {
    return process.env.NODE_ENV === 'production' && !this.config.key_id.includes('test');
  }
}

module.exports = new RazorpayConfig();