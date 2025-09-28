/**
 * Voucher Model
 * Handles voucher data and operations
 */

const { DataTypes } = require('sequelize');
const db = require('../../../config/database');

const Voucher = db.define('oc_voucher', {
  voucher_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.CHAR(1), // F = Fixed Amount, P = Percentage
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  },
  min_order_amount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: true
  },
  max_discount_amount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: true
  },
  date_start: {
    type: DataTypes.DATE,
    allowNull: true
  },
  date_end: {
    type: DataTypes.DATE,
    allowNull: true
  },
  uses_total: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  uses_customer: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  date_added: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'voucher',
  timestamps: false
});

/**
 * Get voucher by code
 * @param {string} code - Voucher code
 * @returns {Promise<Object|null>} Voucher data or null if not found
 */
Voucher.getVoucher = async function(code) {
  if (!code) return null;
  
  const now = new Date();
  
  try {
    const voucher = await Voucher.findOne({
      where: {
        code: code,
        status: true,
        [db.Sequelize.Op.or]: [
          { date_start: null },
          { date_start: { [db.Sequelize.Op.lte]: now } }
        ],
        [db.Sequelize.Op.or]: [
          { date_end: null },
          { date_end: { [db.Sequelize.Op.gte]: now } }
        ]
      }
    });
    
    return voucher ? voucher.toJSON() : null;
  } catch (error) {
    console.error('Error getting voucher:', error);
    return null;
  }
};

/**
 * Validate if voucher can be used by customer
 * @param {number} voucher_id - Voucher ID
 * @param {number} customer_id - Customer ID
 * @param {number} order_total - Order total amount
 * @returns {Promise<Object>} Validation result with status and message
 */
Voucher.validateVoucher = async function(voucher_id, customer_id, order_total) {
  try {
    const voucher = await Voucher.findByPk(voucher_id);
    if (!voucher) {
      return { valid: false, message: 'Voucher not found' };
    }
    
    // Check if voucher is active
    if (!voucher.status) {
      return { valid: false, message: 'Voucher is inactive' };
    }
    
    // Check date validity
    const now = new Date();
    if (voucher.date_start && new Date(voucher.date_start) > now) {
      return { valid: false, message: 'Voucher is not yet valid' };
    }
    
    if (voucher.date_end && new Date(voucher.date_end) < now) {
      return { valid: false, message: 'Voucher has expired' };
    }
    
    // Check minimum order amount
    if (voucher.min_order_amount && order_total < voucher.min_order_amount) {
      return { 
        valid: false, 
        message: `Minimum order amount for this voucher is ${voucher.min_order_amount}`
      };
    }
    
    // Check usage limits
    if (voucher.uses_total > 0) {
      // TODO: Implement history check for total usage
      // const totalUses = await VoucherHistory.count({ where: { voucher_id } });
      // if (totalUses >= voucher.uses_total) {
      //   return { valid: false, message: 'Voucher usage limit has been reached' };
      // }
    }
    
    if (voucher.uses_customer > 0 && customer_id) {
      // TODO: Implement history check for customer usage
      // const customerUses = await VoucherHistory.count({ 
      //   where: { voucher_id, customer_id } 
      // });
      // if (customerUses >= voucher.uses_customer) {
      //   return { valid: false, message: 'You have already used this voucher the maximum number of times' };
      // }
    }
    
    return { valid: true, voucher: voucher.toJSON() };
  } catch (error) {
    console.error('Error validating voucher:', error);
    return { valid: false, message: 'Error validating voucher' };
  }
};

module.exports = Voucher;