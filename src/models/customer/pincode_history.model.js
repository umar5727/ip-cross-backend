const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const PincodeHistory = sequelize.define('pincode_history', {
  history_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'history_id'
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
  pincode: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'pincode'
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'date_added'
  }
}, {
  tableName: 'oc_customer_pincode_history',
  timestamps: false
});

// Static methods
PincodeHistory.getPincodeHistory = async function(customerId) {
  try {
    const pincodes = await this.findAll({
      where: { customer_id: customerId },
      order: [['date_added', 'DESC']],
      limit: 5,
      attributes: ['pincode', 'date_added']
    });
    return pincodes;
  } catch (error) {
    console.error('Error getting pincode history:', error);
    throw error;
  }
};

PincodeHistory.addPincodeHistory = async function(customerId, pincode) {
  try {
    // Check if pincode already exists for this customer
    const existingPincode = await this.findOne({
      where: { 
        customer_id: customerId,
        pincode: pincode
      }
    });

    if (existingPincode) {
      // Update the date_added to current time
      await existingPincode.update({ date_added: new Date() });
      return existingPincode;
    } else {
      // Create new pincode history entry
      const newPincode = await this.create({
        customer_id: customerId,
        pincode: pincode,
        date_added: new Date()
      });
      return newPincode;
    }
  } catch (error) {
    console.error('Error adding pincode history:', error);
    throw error;
  }
};

module.exports = PincodeHistory;
