const axios = require('axios');

class ClickPostService {
  constructor() {
    this.baseURL = 'https://www.clickpost.in/api';
    this.serviceabilityURL = 'https://serviceability.clickpost.in/api/v3/serviceability_api/';
    this.slaURL = 'https://ds.clickpost.in/api/v2/predicted_sla_api/';
    this.trackingURL = 'https://api.clickpost.in/api/v2/track-order/';
    this.cancelURL = 'https://api.clickpost.in/api/v1/cancel-order/?';
    
    // ClickPost credentials from OpenCart
    this.username = process.env.CLICKPOST_USERNAME || 'ipshopy-test';
    this.apiKey = process.env.CLICKPOST_API_KEY || '6cb47441-af83-4d3f-bc49-cbbece04a4c0';
    
    // Debug: Log the credentials being used
    console.log('ClickPost Credentials:');
    console.log('Username:', this.username);
    console.log('API Key:', this.apiKey);
    console.log('Username from env:', process.env.CLICKPOST_USERNAME);
    console.log('API Key from env:', process.env.CLICKPOST_API_KEY);
  }

  /**
   * Check pincode serviceability
   * @param {string} pickupPincode - Vendor pincode
   * @param {string} dropPincode - Customer pincode
   * @returns {Promise<Object>} Serviceability result
   */
  async checkServiceability(pickupPincode, dropPincode) {
    try {
      const payload = [{
        drop_pincode: dropPincode,
        pickup_pincode: pickupPincode,
        service_type: 'FORWARD'
      }];

      const url = `${this.serviceabilityURL}?username=${this.username}&key=${this.apiKey}`;
      console.log('ClickPost Serviceability URL:', url);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      const response = await axios.post(
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.meta && response.data.meta.success) {
        return {
          success: true,
          serviceable: response.data.result.serviceable || false,
          data: response.data
        };
      } else {
        return {
          success: false,
          serviceable: false,
          error: response.data.meta?.message || 'Serviceability check failed'
        };
      }
    } catch (error) {
      console.error('ClickPost Serviceability API Error:', error.message);
      return {
        success: false,
        serviceable: false,
        error: 'Unable to check serviceability at this time'
      };
    }
  }

  /**
   * Get delivery estimate (SLA)
   * @param {string} pickupPincode - Vendor pincode
   * @param {string} dropPincode - Customer pincode
   * @returns {Promise<Object>} SLA result
   */
  async getDeliveryEstimate(pickupPincode, dropPincode) {
    try {
      const payload = [{
        pickup_pincode: pickupPincode,
        drop_pincode: dropPincode
      }];

      const response = await axios.post(
        `${this.slaURL}?username=${this.username}&key=${this.apiKey}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.meta && response.data.meta.success) {
        const result = response.data.result[0] || response.data.result;
        const minDays = result.predicted_sla_min;
        const maxDays = result.predicted_sla_max;
        
        let slaText = '';
        if (minDays === maxDays) {
          slaText = `${minDays} business day${minDays > 1 ? 's' : ''}`;
        } else {
          slaText = `${minDays}-${maxDays} business days`;
        }

        return {
          success: true,
          sla: slaText,
          minDays,
          maxDays,
          data: result
        };
      } else {
        return {
          success: false,
          error: response.data.meta?.message || 'SLA estimation failed'
        };
      }
    } catch (error) {
      console.error('ClickPost SLA API Error:', error.message);
      return {
        success: false,
        error: 'Unable to get delivery estimate at this time'
      };
    }
  }

  /**
   * Track order by AWB number
   * @param {string} awb - AWB number
   * @param {number} cpId - Courier partner ID
   * @returns {Promise<Object>} Tracking result
   */
  async trackOrder(awb, cpId) {
    try {
      const url = `${this.trackingURL}?username=${this.username}&key=${this.apiKey}&waybill=${awb}&cp_id=${cpId}`;
      console.log('ClickPost Tracking URL:', url);
      
      const response = await axios.get(url, {
        timeout: 15000
      });

      console.log('ClickPost Tracking Response:', JSON.stringify(response.data, null, 2));

      // Check if response is JSON data with the correct structure
      if (typeof response.data === 'object' && response.data.meta?.success && response.data.result && response.data.result[awb]) {
        const trackingData = response.data.result[awb];
        return {
          success: true,
          awb: awb,
          status: trackingData.latest_status?.clickpost_status_description || 'Unknown',
          statusCode: trackingData.latest_status?.clickpost_status_code || null,
          history: trackingData.scans || [],
          data: trackingData,
          meta: response.data.meta,
          additional: trackingData.additional
        };
      } else {
        console.log('No tracking data found for AWB:', awb);
        console.log('ClickPost Response Type:', typeof response.data);
        console.log('ClickPost Response Preview:', typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data, null, 2));
        
        return {
          success: false,
          error: 'No tracking data found for this AWB',
          response: response.data,
          response_type: typeof response.data
        };
      }
    } catch (error) {
      console.error('ClickPost Tracking API Error:', error.message);
      if (error.response) {
        console.error('ClickPost Tracking Error Response:', error.response.data);
      }
      return {
        success: false,
        error: 'Unable to track order at this time'
      };
    }
  }

  /**
   * Cancel order
   * @param {string} awb - AWB number
   * @param {string} accountCode - Account code
   * @param {number} cpId - Courier partner ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelOrder(awb, accountCode, cpId) {
    try {
      const cancelUrl = `${this.cancelURL}?username=${encodeURIComponent(this.username)}&key=${encodeURIComponent(this.apiKey)}&waybill=${encodeURIComponent(awb)}&account_code=${encodeURIComponent(accountCode)}&cp_id=${encodeURIComponent(cpId)}`;
      console.log('ClickPost Cancel URL:', cancelUrl);
      console.log('Cancel parameters:', { awb, accountCode, cpId, username: this.username });
      
      const response = await axios.get(cancelUrl, {
        timeout: 15000
      });

      if (response.data.meta && response.data.meta.success) {
        return {
          success: true,
          message: 'Order cancelled successfully',
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.meta?.message || 'Order cancellation failed'
        };
      }
    } catch (error) {
      console.error('ClickPost Cancel API Error:', error.message);
      return {
        success: false,
        error: 'Unable to cancel order at this time'
      };
    }
  }

  /**
   * Convert coordinates to pincode using reverse geocoding
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<string|null>} Pincode
   */
  async getPincodeFromCoordinates(latitude, longitude) {
    try {
      // Using a free reverse geocoding service
      const response = await axios.get(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        { timeout: 5000 }
      );

      if (response.data && response.data.postcode) {
        return response.data.postcode;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error.message);
      return null;
    }
  }
}

module.exports = new ClickPostService();
