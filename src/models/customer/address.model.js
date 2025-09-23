const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Address = sequelize.define('address', {
  address_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'address_id'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id',
    references: {
      model: 'oc_customer',
      key: 'customer_id'
    }
  },
  firstname: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'firstname'
  },
  lastname: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'lastname'
  },
  company: {
    type: DataTypes.STRING(40),
    allowNull: true,
    field: 'company'
  },
  address_1: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'address_1'
  },
  address_2: {
    type: DataTypes.STRING(128),
    allowNull: true,
    field: 'address_2'
  },
  city: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'city'
  },
  postcode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'postcode'
  },
  country_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'country_id'
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'zone_id'
  },
  custom_field: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'custom_field'
  },
  mobile_number: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'mobile_number'
  }
}, {
  tableName: 'oc_address',
  timestamps: false
});

// Static methods for address operations
Address.addAddress = async function(customerId, addressData) {
  try {
    // Check if customer has any existing addresses
    const existingAddresses = await this.count({
      where: { customer_id: customerId }
    });

    // Check if customer has a default address set
    const Customer = require('./customer.model');
    const customer = await Customer.findByPk(customerId, {
      attributes: ['address_id']
    });

    const isFirstAddress = existingAddresses === 0;
    const hasNoDefaultAddress = !customer.address_id;
    const shouldSetAsDefault = addressData.default || isFirstAddress || hasNoDefaultAddress;

    const address = await this.create({
      customer_id: customerId,
      firstname: addressData.firstname,
      lastname: addressData.lastname,
      company: addressData.company || '',
      address_1: addressData.address_1,
      address_2: addressData.address_2 || '',
      city: addressData.city,
      postcode: addressData.postcode || '',
      country_id: addressData.country_id,
      zone_id: addressData.zone_id,
      custom_field: addressData.custom_field ? JSON.stringify(addressData.custom_field) : '',
      mobile_number: addressData.mobile_number || ''
    });

    // Set as default if it's the first address, customer has no default, or explicitly requested
    if (shouldSetAsDefault) {
      await this.updateCustomerDefaultAddress(customerId, address.address_id);
      console.log(`Set address ${address.address_id} as default for customer ${customerId}`);
    }

    return address;
  } catch (error) {
    console.error('Error adding address:', error);
    throw error;
  }
};

Address.editAddress = async function(addressId, customerId, addressData) {
  try {
    const [updatedRowsCount] = await this.update({
      firstname: addressData.firstname,
      lastname: addressData.lastname,
      company: addressData.company || '',
      address_1: addressData.address_1,
      address_2: addressData.address_2 || '',
      city: addressData.city,
      postcode: addressData.postcode || '',
      country_id: addressData.country_id,
      zone_id: addressData.zone_id,
      custom_field: addressData.custom_field ? JSON.stringify(addressData.custom_field) : '',
      mobile_number: addressData.mobile_number || ''
    }, {
      where: {
        address_id: addressId,
        customer_id: customerId
      }
    });

    if (updatedRowsCount === 0) {
      throw new Error('Address not found or access denied');
    }

    // If this is set as default address, update customer table
    if (addressData.default) {
      await this.updateCustomerDefaultAddress(customerId, addressId);
    }

    return updatedRowsCount;
  } catch (error) {
    console.error('Error editing address:', error);
    throw error;
  }
};

Address.deleteAddress = async function(addressId, customerId) {
  try {
    const deletedRowsCount = await this.destroy({
      where: {
        address_id: addressId,
        customer_id: customerId
      }
    });

    if (deletedRowsCount === 0) {
      throw new Error('Address not found or access denied');
    }

    return deletedRowsCount;
  } catch (error) {
    console.error('Error deleting address:', error);
    throw error;
  }
};

Address.getAddress = async function(addressId, customerId) {
  try {
    const address = await this.findOne({
      where: {
        address_id: addressId,
        customer_id: customerId
      }
    });

    if (!address) {
      return null;
    }

    // Get country and zone information
    const countryInfo = await this.getCountryInfo(address.country_id);
    const zoneInfo = await this.getZoneInfo(address.zone_id);

    const addressData = address.toJSON();
    
    return {
      ...addressData,
      country: countryInfo ? countryInfo.name : '',
      iso_code_2: countryInfo ? countryInfo.iso_code_2 : '',
      iso_code_3: countryInfo ? countryInfo.iso_code_3 : '',
      address_format: countryInfo ? countryInfo.address_format : '',
      zone: zoneInfo ? zoneInfo.name : '',
      zone_code: zoneInfo ? zoneInfo.code : '',
      custom_field: addressData.custom_field ? JSON.parse(addressData.custom_field) : {}
    };
  } catch (error) {
    console.error('Error getting address:', error);
    throw error;
  }
};

Address.getAddresses = async function(customerId) {
  try {
    const addresses = await this.findAll({
      where: {
        customer_id: customerId
      }
    });

    const addressesWithDetails = [];

    for (const address of addresses) {
      const countryInfo = await this.getCountryInfo(address.country_id);
      const zoneInfo = await this.getZoneInfo(address.zone_id);

      const addressData = address.toJSON();
      
      addressesWithDetails.push({
        ...addressData,
        country: countryInfo ? countryInfo.name : '',
        iso_code_2: countryInfo ? countryInfo.iso_code_2 : '',
        iso_code_3: countryInfo ? countryInfo.iso_code_3 : '',
        address_format: countryInfo ? countryInfo.address_format : '',
        zone: zoneInfo ? zoneInfo.name : '',
        zone_code: zoneInfo ? zoneInfo.code : '',
        custom_field: addressData.custom_field ? JSON.parse(addressData.custom_field) : {}
      });
    }

    return addressesWithDetails;
  } catch (error) {
    console.error('Error getting addresses:', error);
    throw error;
  }
};

Address.getTotalAddresses = async function(customerId) {
  try {
    const count = await this.count({
      where: {
        customer_id: customerId
      }
    });

    return count;
  } catch (error) {
    console.error('Error getting total addresses:', error);
    throw error;
  }
};

Address.updateCustomerDefaultAddress = async function(customerId, addressId) {
  try {
    const Customer = require('./customer.model');
    await Customer.update({
      address_id: addressId
    }, {
      where: {
        customer_id: customerId
      }
    });
  } catch (error) {
    console.error('Error updating default address:', error);
    throw error;
  }
};

Address.getDefaultAddress = async function(customerId) {
  try {
    const Customer = require('./customer.model');
    const customer = await Customer.findByPk(customerId, {
      attributes: ['address_id']
    });

    if (!customer || !customer.address_id) {
      return null;
    }

    const defaultAddress = await this.findOne({
      where: {
        address_id: customer.address_id,
        customer_id: customerId
      }
    });

    return defaultAddress;
  } catch (error) {
    console.error('Error getting default address:', error);
    throw error;
  }
};

Address.checkDefaultAddressStatus = async function(customerId) {
  try {
    const Customer = require('./customer.model');
    const customer = await Customer.findByPk(customerId, {
      attributes: ['address_id']
    });

    const hasDefaultAddress = !!(customer && customer.address_id);
    
    if (hasDefaultAddress) {
      // Verify the address still exists
      const addressExists = await this.findOne({
        where: {
          address_id: customer.address_id,
          customer_id: customerId
        }
      });

      if (!addressExists) {
        // Address doesn't exist anymore, clear the default
        await Customer.update({
          address_id: null
        }, {
          where: {
            customer_id: customerId
          }
        });
        return { hasDefaultAddress: false, defaultAddressId: null };
      }
    }

    return {
      hasDefaultAddress,
      defaultAddressId: customer ? customer.address_id : null
    };
  } catch (error) {
    console.error('Error checking default address status:', error);
    throw error;
  }
};

Address.getCountryInfo = async function(countryId) {
  try {
    const results = await sequelize.query(
      'SELECT * FROM oc_country WHERE country_id = ?',
      {
        replacements: [countryId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    return results;
  } catch (error) {
    console.error('Error getting country info:', error);
    return null;
  }
};

Address.getZoneInfo = async function(zoneId) {
  try {
    const results = await sequelize.query(
      'SELECT * FROM oc_zone WHERE zone_id = ?',
      {
        replacements: [zoneId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    return results;
  } catch (error) {
    console.error('Error getting zone info:', error);
    return null;
  }
};

Address.getCountries = async function() {
  try {
    const countries = await sequelize.query(
      'SELECT * FROM oc_country WHERE status = 1 ORDER BY name ASC',
      {
        type: sequelize.QueryTypes.SELECT
      }
    );
    return countries;
  } catch (error) {
    console.error('Error getting countries:', error);
    throw error;
  }
};

Address.getZonesByCountry = async function(countryId) {
  try {
    const zones = await sequelize.query(
      'SELECT * FROM oc_zone WHERE country_id = ? AND status = 1 ORDER BY name ASC',
      {
        replacements: [countryId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    return zones;
  } catch (error) {
    console.error('Error getting zones:', error);
    throw error;
  }
};

module.exports = Address;
