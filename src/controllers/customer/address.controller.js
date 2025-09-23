const Address = require('../../models/customer/address.model');

// Get all addresses for a customer
exports.getAddresses = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const addresses = await Address.getAddresses(customerId);

    res.status(200).json({
      success: true,
      data: {
        addresses: addresses
      }
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get addresses'
    });
  }
};

// Get single address by ID
exports.getAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const customerId = req.customer.customer_id;

    const address = await Address.getAddress(parseInt(addressId), customerId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      data: address
    });
  } catch (error) {
    console.error('Get address error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get address'
    });
  }
};

// Add new address
exports.addAddress = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const addressData = req.body;

    // Validate required fields
    const validation = validateAddressData(addressData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const address = await Address.addAddress(customerId, addressData);

    // Check if this address was set as default
    const Customer = require('../../models/customer/customer.model');
    const customer = await Customer.findByPk(customerId, {
      attributes: ['address_id']
    });

    const wasSetAsDefault = customer && customer.address_id === address.address_id;

    res.status(201).json({
      success: true,
      message: wasSetAsDefault ? 'Address added and set as default successfully' : 'Address added successfully',
      data: {
        address_id: address.address_id,
        is_default: wasSetAsDefault
      }
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not add address'
    });
  }
};

// Update address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const customerId = req.customer.customer_id;
    const addressData = req.body;

    // Validate required fields
    const validation = validateAddressData(addressData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    await Address.editAddress(parseInt(addressId), customerId, addressData);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully'
    });
  } catch (error) {
    console.error('Update address error:', error);
    if (error.message === 'Address not found or access denied') {
      return res.status(404).json({
        success: false,
        message: 'Address not found or access denied'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Could not update address'
    });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const customerId = req.customer.customer_id;

    // Check if this is the only address
    const totalAddresses = await Address.getTotalAddresses(customerId);
    if (totalAddresses <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only address. You must have at least one address.'
      });
    }

    await Address.deleteAddress(parseInt(addressId), customerId);

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    if (error.message === 'Address not found or access denied') {
      return res.status(404).json({
        success: false,
        message: 'Address not found or access denied'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Could not delete address'
    });
  }
};

// Get total address count
exports.getTotalAddresses = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const total = await Address.getTotalAddresses(customerId);

    res.status(200).json({
      success: true,
      data: {
        total: total
      }
    });
  } catch (error) {
    console.error('Get total addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get total addresses'
    });
  }
};

// Get countries list
exports.getCountries = async (req, res) => {
  try {
    const countries = await Address.getCountries();

    res.status(200).json({
      success: true,
      data: {
        countries: countries
      }
    });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get countries'
    });
  }
};

// Get zones by country
exports.getZonesByCountry = async (req, res) => {
  try {
    const { countryId } = req.params;
    const zones = await Address.getZonesByCountry(parseInt(countryId));

    res.status(200).json({
      success: true,
      data: {
        zones: zones
      }
    });
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get zones'
    });
  }
};

// Set default address
exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const customerId = req.customer.customer_id;

    // Verify address belongs to customer
    const address = await Address.getAddress(parseInt(addressId), customerId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or access denied'
      });
    }

    await Address.updateCustomerDefaultAddress(customerId, parseInt(addressId));

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully'
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not set default address'
    });
  }
};

// Get default address
exports.getDefaultAddress = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const defaultAddress = await Address.getDefaultAddress(customerId);

    if (!defaultAddress) {
      return res.status(404).json({
        success: false,
        message: 'No default address found'
      });
    }

    res.status(200).json({
      success: true,
      data: defaultAddress
    });
  } catch (error) {
    console.error('Get default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get default address'
    });
  }
};

// Check default address status
exports.checkDefaultAddressStatus = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const status = await Address.checkDefaultAddressStatus(customerId);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Check default address status error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not check default address status'
    });
  }
};

// Address validation function
function validateAddressData(data) {
  const errors = {};

  // Required fields validation
  if (!data.firstname || data.firstname.trim().length < 1 || data.firstname.trim().length > 32) {
    errors.firstname = 'First name must be between 1 and 32 characters';
  }

  if (!data.lastname || data.lastname.trim().length < 1 || data.lastname.trim().length > 32) {
    errors.lastname = 'Last name must be between 1 and 32 characters';
  }

  if (!data.address_1 || data.address_1.trim().length < 3 || data.address_1.trim().length > 128) {
    errors.address_1 = 'Address must be between 3 and 128 characters';
  }

  if (!data.city || data.city.trim().length < 2 || data.city.trim().length > 128) {
    errors.city = 'City must be between 2 and 128 characters';
  }

  if (!data.country_id || !Number.isInteger(parseInt(data.country_id))) {
    errors.country = 'Country is required';
  }

  if (!data.zone_id || !Number.isInteger(parseInt(data.zone_id))) {
    errors.zone = 'State/Province is required';
  }

  // Postcode validation (if provided)
  if (data.postcode && data.postcode.trim().length > 0) {
    if (!/^[0-9]{6}$/.test(data.postcode.trim())) {
      errors.postcode = 'Postcode must be 6 digits';
    }
  }

  // Mobile number validation (if provided)
  if (data.mobile_number && data.mobile_number.trim().length > 0) {
    if (data.mobile_number.trim().length > 32) {
      errors.mobile_number = 'Mobile number must be less than 32 characters';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: errors
  };
}
