const axios = require('axios');

class InetractService {
  constructor() {
    // Inetract API configuration
    this.apiKey = process.env.INETRACT_API_KEY;
    this.baseUrl = process.env.INETRACT_BASE_URL || 'https://api.inetract.com/v1';
    this.senderId = process.env.INETRACT_SENDER_ID || 'IPSHOPY';
  }

  // Format phone number for WhatsApp (add country code if missing)
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91)
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }

  // Send OTP via WhatsApp using Inetract API
  async sendOTP(phoneNumber, otpCode, customerName = 'User') {
    try {
      if (!this.apiKey) {
        throw new Error('Inetract API key not configured. Please set INETRACT_API_KEY in .env file');
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const message = `Hello ${customerName}! Your OTP for IPSHOPY login is: ${otpCode}. This OTP is valid for 5 minutes. Do not share this code with anyone.`;

      const payload = {
        to: formattedPhone,
        message: message,
        type: 'whatsapp',
        sender_id: this.senderId
      };

      const response = await axios.post(`${this.baseUrl}/send`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`WhatsApp OTP sent via Inetract to ${formattedPhone}: ${otpCode}`);
      return {
        success: true,
        messageId: response.data.message_id || response.data.id,
        phoneNumber: formattedPhone
      };

    } catch (error) {
      console.error('Inetract WhatsApp OTP send error:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp OTP via Inetract');
    }
  }

  // Generate OTP (6 digits)
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP in Redis (not database)
  async storeOTP(phoneNumber, otpCode) {
    try {
      const { redisClient } = require('../../config/redis');
      const key = `otp:${phoneNumber}`;
      const data = {
        code: otpCode,
        createdAt: new Date().toISOString(),
        attempts: 0
      };
      
      // Store for 5 minutes
      await redisClient.setex(key, 300, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error storing OTP in Redis:', error);
      return false;
    }
  }

  // Verify OTP from Redis
  async verifyOTP(phoneNumber, otpCode) {
    try {
      const { redisClient } = require('../../config/redis');
      const key = `otp:${phoneNumber}`;
      const storedData = await redisClient.get(key);
      
      if (!storedData) {
        return { valid: false, message: 'OTP not found or expired' };
      }

      const data = JSON.parse(storedData);
      
      // Check attempts
      if (data.attempts >= 3) {
        await redisClient.del(key);
        return { valid: false, message: 'Too many failed attempts. Please request a new OTP.' };
      }

      // Verify OTP
      if (data.code === otpCode) {
        await redisClient.del(key);
        return { valid: true, message: 'OTP verified successfully' };
      } else {
        // Increment attempts
        data.attempts += 1;
        await redisClient.setex(key, 300, JSON.stringify(data));
        return { valid: false, message: 'Invalid OTP' };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { valid: false, message: 'Error verifying OTP' };
    }
  }
}

module.exports = new InetractService();
