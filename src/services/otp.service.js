const axios = require('axios');
const { redisClient } = require('../../config/redis');
const crypto = require('crypto');

class OTPService {
  constructor() {
    // Interakt WhatsApp API Configuration
    this.interaktApiKey = process.env.INTERAKT_API_KEY || 'OTVCaWh1VFVNdHlVUkFzMEl4Yy1mN1BYeWVBM243dW1lZTNkWG5tMXJ5dzo=';
    this.interaktApiUrl = 'https://api.interakt.ai/v1/public/message/';
    
    this.otpExpiry = 300; // 5 minutes in seconds
    this.maxAttempts = 3; // Maximum OTP verification attempts
    this.lockoutDuration = 300; // 5 minutes lockout after max attempts
  }

  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Format phone number for Interakt API
   * @param {string} phoneNumber - Phone number from user input
   * @returns {string} - Formatted phone number without country code
   */
  formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // If number starts with 0, remove it
    const withoutLeadingZero = cleanNumber.startsWith('0') ? cleanNumber.substring(1) : cleanNumber;
    
    // Remove country code if present (91)
    const withoutCountryCode = withoutLeadingZero.startsWith('91') ? withoutLeadingZero.substring(2) : withoutLeadingZero;
    
    return withoutCountryCode;
  }

  /**
   * Check if phone number is locked out due to too many failed attempts
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<Object>} - Lockout status
   */
  async checkLockoutStatus(phoneNumber) {
    return new Promise((resolve) => {
      try {
        const lockoutKey = `lockout_${phoneNumber}`;
        redisClient.get(lockoutKey, (err, lockoutData) => {
          if (err) {
            console.error('Redis get error for lockout status:', err);
            return resolve({
              isLocked: false,
              lockoutRemaining: 0
            });
          }

          if (lockoutData) {
            const lockoutInfo = JSON.parse(lockoutData);
            const timeRemaining = Math.max(0, lockoutInfo.expiresAt - Date.now());
            return resolve({
              isLocked: timeRemaining > 0,
              lockoutRemaining: Math.ceil(timeRemaining / 1000) // Convert to seconds
            });
          }

          resolve({
            isLocked: false,
            lockoutRemaining: 0
          });
        });
      } catch (error) {
        console.error('Error checking lockout status:', error);
        resolve({
          isLocked: false,
          lockoutRemaining: 0
        });
      }
    });
  }

  /**
   * Send OTP via Interakt WhatsApp Template API
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<Object>} - API response
   */
  async sendOTP(phoneNumber) {
    try {
      // Check if phone number is locked out
      const lockoutStatus = await this.checkLockoutStatus(phoneNumber);
      if (lockoutStatus.isLocked) {
        return {
          success: false,
          message: `Account is temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.lockoutRemaining} seconds.`,
          code: 'ACCOUNT_LOCKED',
          lockoutRemaining: lockoutStatus.lockoutRemaining
        };
      }

      const otp = this.generateOTP();
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      console.log('Sending OTP via WhatsApp Template to:', `+91${formattedNumber}`);
      
      const payload = {
        countryCode: "+91",
        phoneNumber: formattedNumber,
        callbackData: `otp_${Date.now()}`,
        type: "Template",
        template: {
          name: "o_t_p_d6",
          languageCode: "en",
          bodyValues: [otp],
          buttonValues: {
            "0": [otp]
          }
        }
      };

      console.log('Interakt Template Payload:', JSON.stringify(payload, null, 2));

      // Send OTP via Interakt WhatsApp Template API
      const response = await axios.post(this.interaktApiUrl, payload, {
        headers: {
          'Authorization': `Basic ${this.interaktApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Interakt API Response:', response.data);

      if (response.status === 201 && response.data.result) {
        // Store OTP in Redis with expiration
        const otpKey = `otp_${phoneNumber}`; // Use original phone number for key
        const otpData = {
          otp: otp,
          phoneNumber: formattedNumber,
          attempts: 0,
          createdAt: Date.now(),
          canResend: false
        };

        redisClient.setex(otpKey, this.otpExpiry, JSON.stringify(otpData), (setErr) => {
          if (setErr) console.error('Redis setex error:', setErr);
        });

        // Set resend cooldown (60 seconds)
        const resendKey = `resend_${phoneNumber}`; // Use original phone number for key
        redisClient.setex(resendKey, 60, 'true', (setErr) => {
          if (setErr) console.error('Redis resend cooldown error:', setErr);
        });
        
        console.log(`OTP sent successfully via WhatsApp Template to +91${formattedNumber}`);
        return {
          success: true,
          message: 'OTP sent successfully via WhatsApp',
          messageId: response.data.id,
          canResend: false,
          resendAfter: 60
        };
      } else {
        throw new Error('Failed to send OTP via WhatsApp Template');
      }
    } catch (error) {
      console.error('Error sending OTP:', error.response?.data || error.message);
      
      // For testing purposes, if API fails, still store OTP in Redis
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        console.log('Development mode: Storing OTP in Redis despite API failure');
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        const otpKey = `otp_${phoneNumber}`; // Use original phone number for key
        const otpData = {
          otp: this.generateOTP(),
          phoneNumber: formattedNumber,
          attempts: 0,
          createdAt: Date.now(),
          canResend: false
        };

        redisClient.setex(otpKey, this.otpExpiry, JSON.stringify(otpData), (setErr) => {
          if (setErr) console.error('Redis setex error:', setErr);
        });

        // Set resend cooldown (60 seconds)
        const resendKey = `resend_${phoneNumber}`; // Use original phone number for key
        redisClient.setex(resendKey, 60, 'true', (setErr) => {
          if (setErr) console.error('Redis resend cooldown error:', setErr);
        });
        
        return {
          success: true,
          message: 'OTP stored for testing (WhatsApp API failed)',
          messageId: 'test_' + Date.now(),
          canResend: false,
          resendAfter: 60
        };
      }
      
      return {
        success: false,
        message: 'Failed to send OTP via WhatsApp',
        error: error.response?.data || error.message
      };
    }
  }


  /**
   * Verify OTP
   * @param {string} phoneNumber - Customer's phone number
   * @param {string} enteredOTP - OTP entered by customer
   * @returns {Promise<Object>} - Verification result
   */
  async verifyOTP(phoneNumber, enteredOTP) {
    return new Promise((resolve, reject) => {
      try {
        const otpKey = `otp_${phoneNumber}`; // Use original phone number for key

        // Get OTP data from Redis
        redisClient.get(otpKey, (err, otpDataStr) => {
          if (err) {
            console.error('Redis get error:', err);
            return resolve({
              success: false,
              message: 'Error verifying OTP',
              error: err.message
            });
          }
          
          if (!otpDataStr) {
            return resolve({
              success: false,
              message: 'OTP expired or not found',
              code: 'OTP_EXPIRED'
            });
          }

          try {
            const otpData = JSON.parse(otpDataStr);
            
            // Verify OTP
            if (otpData.otp === enteredOTP) {
              // Delete OTP after successful verification
              redisClient.del(otpKey, (delErr) => {
                if (delErr) console.error('Redis del error:', delErr);
              });
              return resolve({
                success: true,
                message: 'OTP verified successfully',
                phoneNumber: phoneNumber
              });
            } else {
              // Increment attempts
              otpData.attempts += 1;
              
              // Check if max attempts exceeded after increment
              if (otpData.attempts >= this.maxAttempts) {
                // Set lockout for 5 minutes
                const lockoutKey = `lockout_${phoneNumber}`;
                const lockoutData = {
                  phoneNumber: phoneNumber,
                  lockedAt: Date.now(),
                  expiresAt: Date.now() + (this.lockoutDuration * 1000) // Convert to milliseconds
                };
                
                redisClient.setex(lockoutKey, this.lockoutDuration, JSON.stringify(lockoutData), (lockoutErr) => {
                  if (lockoutErr) console.error('Redis lockout setex error:', lockoutErr);
                });
                
                // Delete OTP after max attempts
                redisClient.del(otpKey, (delErr) => {
                  if (delErr) console.error('Redis del error:', delErr);
                });
                
                return resolve({
                  success: false,
                  message: `Maximum verification attempts exceeded. Account locked for ${this.lockoutDuration} seconds.`,
                  code: 'MAX_ATTEMPTS_EXCEEDED',
                  lockoutDuration: this.lockoutDuration
                });
              }
              
              // Update attempts in Redis
              redisClient.setex(otpKey, this.otpExpiry, JSON.stringify(otpData), (setErr) => {
                if (setErr) console.error('Redis setex error:', setErr);
              });
              
              const remainingAttempts = this.maxAttempts - otpData.attempts;
              return resolve({
                success: false,
                message: `Invalid OTP. ${remainingAttempts} attempts remaining`,
                code: 'INVALID_OTP',
                remainingAttempts: remainingAttempts
              });
            }
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return resolve({
              success: false,
              message: 'Error parsing OTP data',
              error: parseError.message
            });
          }
        });
      } catch (error) {
        console.error('Error verifying OTP:', error);
        resolve({
          success: false,
          message: 'Error verifying OTP',
          error: error.message
        });
      }
    });
  }

  /**
   * Check if OTP exists for phone number
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<boolean>} - Whether OTP exists
   */
  async hasActiveOTP(phoneNumber) {
    return new Promise((resolve) => {
      try {
        const otpKey = `otp_${phoneNumber}`; // Use original phone number for key
        redisClient.exists(otpKey, (err, exists) => {
          if (err) {
            console.error('Redis exists error:', err);
            return resolve(false);
          }
          resolve(exists === 1);
        });
      } catch (error) {
        console.error('Error checking OTP existence:', error);
        resolve(false);
      }
    });
  }

  /**
   * Resend OTP (with 60-second cooldown)
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<Object>} - Resend result
   */
  async resendOTP(phoneNumber) {
    return new Promise(async (resolve) => {
      try {
        // Check if phone number is locked out
        const lockoutStatus = await this.checkLockoutStatus(phoneNumber);
        if (lockoutStatus.isLocked) {
          return resolve({
            success: false,
            message: `Account is temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.lockoutRemaining} seconds.`,
            code: 'ACCOUNT_LOCKED',
            lockoutRemaining: lockoutStatus.lockoutRemaining
          });
        }

        const resendKey = `resend_${phoneNumber}`; // Use original phone number for key
        
        // Check if resend is allowed (60-second cooldown)
        redisClient.get(resendKey, async (err, resendData) => {
          if (err) {
            console.error('Redis get error for resend cooldown:', err);
            return resolve({
              success: false,
              message: 'Error checking resend cooldown',
              error: err.message
            });
          }

          if (resendData) {
            return resolve({
              success: false,
              message: 'Please wait 60 seconds before requesting another OTP',
              code: 'RESEND_COOLDOWN',
              canResend: false,
              resendAfter: 60
            });
          }

          // Invalidate previous OTP
          const otpKey = `otp_${phoneNumber}`; // Use original phone number for key
          redisClient.del(otpKey, (delErr) => {
            if (delErr) console.error('Redis del error for previous OTP:', delErr);
          });

          // Send new OTP
          const result = await this.sendOTP(phoneNumber);
          resolve(result);
        });
      } catch (error) {
        console.error('Error resending OTP:', error);
        resolve({
          success: false,
          message: 'Error resending OTP',
          error: error.message
        });
      }
    });
  }

  /**
   * Check if resend is allowed
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<Object>} - Resend status
   */
  async checkResendStatus(phoneNumber) {
    return new Promise(async (resolve) => {
      try {
        // Check lockout status first
        const lockoutStatus = await this.checkLockoutStatus(phoneNumber);
        if (lockoutStatus.isLocked) {
          return resolve({
            canResend: false,
            resendAfter: lockoutStatus.lockoutRemaining,
            isLocked: true,
            lockoutRemaining: lockoutStatus.lockoutRemaining
          });
        }

        const resendKey = `resend_${phoneNumber}`; // Use original phone number for key
        
        redisClient.get(resendKey, (err, resendData) => {
          if (err) {
            console.error('Redis get error for resend status:', err);
            return resolve({
              canResend: true,
              resendAfter: 0,
              isLocked: false
            });
          }

          if (resendData) {
            return resolve({
              canResend: false,
              resendAfter: 60,
              isLocked: false
            });
          }

          resolve({
            canResend: true,
            resendAfter: 0,
            isLocked: false
          });
        });
      } catch (error) {
        console.error('Error checking resend status:', error);
        resolve({
          canResend: true,
          resendAfter: 0,
          isLocked: false
        });
      }
    });
  }
}

module.exports = new OTPService();
