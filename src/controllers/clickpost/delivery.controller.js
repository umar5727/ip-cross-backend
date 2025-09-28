const ClickPostService = require('../../services/clickpost.service');
const Vendor = require('../../models/clickpost/vendor.model');

/**
 * PUBLIC API: Get estimated delivery date for product page (no authentication required)
 * This endpoint is designed for Flutter app product pages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getPublicDeliveryEstimate = async (req, res) => {
  try {
    const { product_id, latitude, longitude, pincode } = req.body;

    // Validate required parameters
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Either latitude/longitude OR pincode is required
    if (!latitude && !longitude && !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Either location coordinates (latitude, longitude) or pincode is required'
      });
    }

    // Get vendor information for the product using raw query
    const sequelize = require('../../../config/database');
    const vendorResult = await sequelize.query(`
      SELECT v.vendor_id, v.postcode, v.city, v.zone_id, z.name as zone_name
      FROM oc_vendor_to_product vp
      LEFT JOIN oc_vendor v ON vp.vendor_id = v.vendor_id
      LEFT JOIN oc_zone z ON v.zone_id = z.zone_id
      WHERE vp.product_id = :product_id
      LIMIT 1
    `, {
      replacements: { product_id: product_id },
      type: sequelize.QueryTypes.SELECT
    });

    if (!vendorResult || vendorResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor information not available for this product'
      });
    }

    const vendor = vendorResult[0];

    const vendorPincode = vendor.postcode;
    let customerPincode = pincode;

    // If pincode not provided, use reverse geocoding (simplified for demo)
    if (!customerPincode && latitude && longitude) {
      // For demo purposes, we'll use a simple mapping
      // In production, you'd use a proper reverse geocoding service
      customerPincode = await getPincodeFromCoordinates(latitude, longitude);
    }

    if (!customerPincode) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine delivery location. Please provide pincode or enable location access.'
      });
    }

    // Clean pincodes (remove non-numeric characters)
    const cleanVendorPincode = vendorPincode ? vendorPincode.toString().replace(/\D/g, '') : '';
    const cleanCustomerPincode = customerPincode ? customerPincode.toString().replace(/\D/g, '') : '';

    if (!cleanVendorPincode || !cleanCustomerPincode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pincode format'
      });
    }

    // Check serviceability
    const serviceabilityResult = await ClickPostService.checkServiceability(
      cleanVendorPincode, 
      cleanCustomerPincode
    );

    if (!serviceabilityResult.success || !serviceabilityResult.serviceable) {
      return res.status(200).json({
        success: true,
        message: 'Delivery not available to this location',
        data: {
          product_id: product_id,
          vendor_pincode: cleanVendorPincode,
          customer_pincode: cleanCustomerPincode,
          serviceable: false,
          estimated_delivery: null,
          sla_days: null
        }
      });
    }

    // Get delivery estimate
    const slaResult = await ClickPostService.getDeliveryEstimate(
      cleanVendorPincode,
      cleanCustomerPincode
    );

    // Calculate estimated delivery date with 3-day buffer
    let estimatedDelivery = 'Unable to estimate delivery date';
    let slaDays = 0;
    
    if (slaResult.success) {
      const today = new Date();
      const BUFFER_DAYS = 3; // Add 3 extra days to ClickPost SLA
      
      // Add business days (skip weekends)
      const addBusinessDays = (date, days) => {
        const result = new Date(date);
        let addedDays = 0;
        while (addedDays < days) {
          result.setDate(result.getDate() + 1);
          if (result.getDay() !== 0 && result.getDay() !== 6) { // Skip Sunday (0) and Saturday (6)
            addedDays++;
          }
        }
        return result;
      };

      // Add buffer days to ClickPost SLA
      const adjustedMinDays = slaResult.minDays + BUFFER_DAYS;
      const adjustedMaxDays = slaResult.maxDays + BUFFER_DAYS;
      slaDays = adjustedMinDays; // Use adjusted min days for sla_days

      if (slaResult.minDays === slaResult.maxDays) {
        const deliveryDate = addBusinessDays(today, adjustedMinDays);
        estimatedDelivery = deliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } else {
        const minDeliveryDate = addBusinessDays(today, adjustedMinDays);
        const maxDeliveryDate = addBusinessDays(today, adjustedMaxDays);
        
        const minFormatted = minDeliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short'
        });
        const maxFormatted = maxDeliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        
        estimatedDelivery = `${minFormatted} - ${maxFormatted}`;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Delivery estimation successful',
      data: {
        product_id: product_id,
        vendor_pincode: cleanVendorPincode,
        customer_pincode: cleanCustomerPincode,
        serviceable: true,
        estimated_delivery: estimatedDelivery,
        sla_days: slaDays,
        sla_details: slaResult.success ? {
          sla_text: slaResult.sla,
          min_days: slaResult.minDays,
          max_days: slaResult.maxDays,
          buffer_days: 3,
          adjusted_min_days: slaResult.minDays + 3,
          adjusted_max_days: slaResult.maxDays + 3
        } : null
      }
    });

  } catch (error) {
    console.error('Public delivery estimation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

/**
 * Simple reverse geocoding function (for demo purposes)
 * In production, use a proper service like Google Maps API, OpenCage, etc.
 */
async function getPincodeFromCoordinates(latitude, longitude) {
  // This is a simplified demo function
  // In production, you would call a real reverse geocoding service
  
  // For demo, we'll return some sample pincodes based on coordinates
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  // Delhi area
  if (lat >= 28.4 && lat <= 28.8 && lng >= 76.8 && lng <= 77.4) {
    return '110001';
  }
  // Mumbai area
  if (lat >= 19.0 && lat <= 19.3 && lng >= 72.8 && lng <= 73.0) {
    return '400001';
  }
  // Bangalore area
  if (lat >= 12.8 && lat <= 13.2 && lng >= 77.4 && lng <= 77.8) {
    return '560001';
  }
  // Chennai area
  if (lat >= 13.0 && lat <= 13.2 && lng >= 80.2 && lng <= 80.3) {
    return '600001';
  }
  // Kolkata area
  if (lat >= 22.5 && lat <= 22.7 && lng >= 88.3 && lng <= 88.4) {
    return '700001';
  }
  
  // Default fallback
  return '110001';
}

/**
 * Get estimated delivery date based on customer location and product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.estimateDelivery = async (req, res) => {
  try {
    const { product_id, latitude, longitude, pincode } = req.body;

    // Validate required parameters
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Customer location (latitude and longitude) is required'
      });
    }

    // Get vendor pincode for the product
    const vendorPincode = await Vendor.getVendorPincode(product_id);
    
    if (!vendorPincode) {
      return res.status(404).json({
        success: false,
        message: 'Vendor information not available for this product'
      });
    }

    // Get customer pincode from coordinates if not provided
    let customerPincode = pincode;
    if (!customerPincode) {
      customerPincode = await ClickPostService.getPincodeFromCoordinates(latitude, longitude);
      
      if (!customerPincode) {
        return res.status(400).json({
          success: false,
          message: 'Unable to determine pincode from coordinates. Please provide pincode directly.'
        });
      }
    }

    // Clean pincodes (remove non-numeric characters)
    const cleanVendorPincode = vendorPincode ? vendorPincode.toString().replace(/\D/g, '') : '';
    const cleanCustomerPincode = customerPincode ? customerPincode.toString().replace(/\D/g, '') : '';

    // Validate pincode format
    if (!/^\d{6}$/.test(cleanVendorPincode) || !/^\d{6}$/.test(cleanCustomerPincode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pincode format. Please provide valid 6-digit pincodes.'
      });
    }

    // Check serviceability
    const serviceabilityResult = await ClickPostService.checkServiceability(
      cleanVendorPincode, 
      cleanCustomerPincode
    );

    if (!serviceabilityResult.success || !serviceabilityResult.serviceable) {
      return res.status(400).json({
        success: false,
        message: serviceabilityResult.error || 'Delivery not available to this location',
        data: {
          vendor_pincode: cleanVendorPincode,
          customer_pincode: cleanCustomerPincode,
          serviceable: false
        }
      });
    }

    // Get delivery estimate
    const slaResult = await ClickPostService.getDeliveryEstimate(
      cleanVendorPincode,
      cleanCustomerPincode
    );

    // Calculate estimated delivery date with 3-day buffer
    let estimatedDelivery = 'Unable to estimate delivery date';
    let slaDays = 0;
    
    if (slaResult.success) {
      const today = new Date();
      const BUFFER_DAYS = 3; // Add 3 extra days to ClickPost SLA
      
      // Add business days (skip weekends)
      const addBusinessDays = (date, days) => {
        const result = new Date(date);
        let addedDays = 0;
        while (addedDays < days) {
          result.setDate(result.getDate() + 1);
          if (result.getDay() !== 0 && result.getDay() !== 6) { // Skip Sunday (0) and Saturday (6)
            addedDays++;
          }
        }
        return result;
      };

      // Add buffer days to ClickPost SLA
      const adjustedMinDays = slaResult.minDays + BUFFER_DAYS;
      const adjustedMaxDays = slaResult.maxDays + BUFFER_DAYS;
      slaDays = adjustedMinDays; // Use adjusted min days for sla_days

      if (slaResult.minDays === slaResult.maxDays) {
        const deliveryDate = addBusinessDays(today, adjustedMinDays);
        estimatedDelivery = deliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } else {
        const minDeliveryDate = addBusinessDays(today, adjustedMinDays);
        const maxDeliveryDate = addBusinessDays(today, adjustedMaxDays);
        
        const minFormatted = minDeliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short'
        });
        const maxFormatted = maxDeliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        
        estimatedDelivery = `${minFormatted} - ${maxFormatted}`;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Delivery estimation successful',
      data: {
        product_id: product_id,
        vendor_pincode: cleanVendorPincode,
        customer_pincode: cleanCustomerPincode,
        serviceable: true,
        estimated_delivery: estimatedDelivery,
        sla_days: slaDays,
        sla_details: slaResult.success ? {
          sla_text: slaResult.sla,
          min_days: slaResult.minDays,
          max_days: slaResult.maxDays,
          buffer_days: 3,
          adjusted_min_days: slaResult.minDays + 3,
          adjusted_max_days: slaResult.maxDays + 3
        } : null,
        coordinates: {
          latitude: latitude,
          longitude: longitude
        }
      }
    });

  } catch (error) {
    console.error('Delivery estimation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while estimating delivery'
    });
  }
};

/**
 * Get delivery estimation by pincode only (without coordinates)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.estimateDeliveryByPincode = async (req, res) => {
  try {
    const { product_id, pincode } = req.body;

    // Validate required parameters
    if (!product_id || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and pincode are required'
      });
    }

    // Get vendor pincode for the product
    const vendorPincode = await Vendor.getVendorPincode(product_id);
    
    if (!vendorPincode) {
      return res.status(404).json({
        success: false,
        message: 'Vendor information not available for this product'
      });
    }

    // Clean pincodes
    const cleanVendorPincode = vendorPincode.replace(/\D/g, '');
    const cleanCustomerPincode = pincode.replace(/\D/g, '');

    // Validate pincode format
    if (!/^\d{6}$/.test(cleanVendorPincode) || !/^\d{6}$/.test(cleanCustomerPincode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pincode format. Please provide valid 6-digit pincodes.'
      });
    }

    // Check serviceability
    const serviceabilityResult = await ClickPostService.checkServiceability(
      cleanVendorPincode, 
      cleanCustomerPincode
    );

    if (!serviceabilityResult.success || !serviceabilityResult.serviceable) {
      return res.status(400).json({
        success: false,
        message: serviceabilityResult.error || 'Delivery not available to this location',
        data: {
          vendor_pincode: cleanVendorPincode,
          customer_pincode: cleanCustomerPincode,
          serviceable: false
        }
      });
    }

    // Get delivery estimate
    const slaResult = await ClickPostService.getDeliveryEstimate(
      cleanVendorPincode,
      cleanCustomerPincode
    );

    // Calculate estimated delivery date with 3-day buffer
    let estimatedDelivery = 'Unable to estimate delivery date';
    let slaDays = 0;
    
    if (slaResult.success) {
      const today = new Date();
      const BUFFER_DAYS = 3; // Add 3 extra days to ClickPost SLA
      
      // Add business days (skip weekends)
      const addBusinessDays = (date, days) => {
        const result = new Date(date);
        let addedDays = 0;
        while (addedDays < days) {
          result.setDate(result.getDate() + 1);
          if (result.getDay() !== 0 && result.getDay() !== 6) {
            addedDays++;
          }
        }
        return result;
      };

      // Add buffer days to ClickPost SLA
      const adjustedMinDays = slaResult.minDays + BUFFER_DAYS;
      const adjustedMaxDays = slaResult.maxDays + BUFFER_DAYS;
      slaDays = adjustedMinDays; // Use adjusted min days for sla_days

      if (slaResult.minDays === slaResult.maxDays) {
        const deliveryDate = addBusinessDays(today, adjustedMinDays);
        estimatedDelivery = deliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } else {
        const minDeliveryDate = addBusinessDays(today, adjustedMinDays);
        const maxDeliveryDate = addBusinessDays(today, adjustedMaxDays);
        
        const minFormatted = minDeliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short'
        });
        const maxFormatted = maxDeliveryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        
        estimatedDelivery = `${minFormatted} - ${maxFormatted}`;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Delivery estimation successful',
      data: {
        product_id: product_id,
        vendor_pincode: cleanVendorPincode,
        customer_pincode: cleanCustomerPincode,
        serviceable: true,
        estimated_delivery: estimatedDelivery,
        sla_days: slaDays,
        sla_details: slaResult.success ? {
          sla_text: slaResult.sla,
          min_days: slaResult.minDays,
          max_days: slaResult.maxDays,
          buffer_days: 3,
          adjusted_min_days: slaResult.minDays + 3,
          adjusted_max_days: slaResult.maxDays + 3
        } : null
      }
    });

  } catch (error) {
    console.error('Delivery estimation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while estimating delivery'
    });
  }
};
