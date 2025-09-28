/**
 * Coupon Model
 * Handles coupon data and operations
 */

const { DataTypes } = require('sequelize');
const db = require('../../../config/database');

const Coupon = db.define('coupon', {
  coupon_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(20),
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
  tableName: 'coupon',
  timestamps: false
});

/**
 * Get coupon by code
 * @param {string} code - Coupon code
 * @returns {Promise<Object|null>} Coupon data or null if not found
 */
Coupon.getCoupon = async function(code) {
  if (!code) return null;
  
  const now = new Date();
  
  try {
    const coupon = await Coupon.findOne({
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
    
    return coupon ? coupon.toJSON() : null;
  } catch (error) {
    console.error('Error getting coupon:', error);
    return null;
  }
};

/**
 * Validate if coupon can be used by customer
 * @param {number} coupon_id - Coupon ID
 * @param {number} customer_id - Customer ID
 * @param {number} order_total - Order total amount
 * @returns {Promise<Object>} Validation result with status and message
 */
Coupon.validateCoupon = async function(coupon_id, customer_id, order_total) {
  try {
    const coupon = await Coupon.findByPk(coupon_id);
    if (!coupon) {
      return { valid: false, message: 'Coupon not found' };
    }
    
    // Check if coupon is active
    if (!coupon.status) {
      return { valid: false, message: 'Coupon is inactive' };
    }
    
    // Check date validity
    const now = new Date();
    if (coupon.date_start && new Date(coupon.date_start) > now) {
      return { valid: false, message: 'Coupon is not yet valid' };
    }
    
    if (coupon.date_end && new Date(coupon.date_end) < now) {
      return { valid: false, message: 'Coupon has expired' };
    }
    
    // Check minimum order amount
    if (coupon.min_order_amount && order_total < coupon.min_order_amount) {
      return { 
        valid: false, 
        message: `Minimum order amount for this coupon is ${coupon.min_order_amount}`
      };
    }
    
    // Check usage limits
    if (coupon.uses_total > 0) {
      // TODO: Implement history check for total usage
      // const totalUses = await CouponHistory.count({ where: { coupon_id } });
      // if (totalUses >= coupon.uses_total) {
      //   return { valid: false, message: 'Coupon usage limit has been reached' };
      // }
    }
    
    if (coupon.uses_customer > 0 && customer_id) {
      // TODO: Implement history check for customer usage
      // const customerUses = await CouponHistory.count({ 
      //   where: { coupon_id, customer_id } 
      // });
      // if (customerUses >= coupon.uses_customer) {
      //   return { valid: false, message: 'You have already used this coupon the maximum number of times' };
      // }
    }
    
    return { valid: true, coupon: coupon.toJSON() };
  } catch (error) {
    console.error('Error validating coupon:', error);
    return { valid: false, message: 'Error validating coupon' };
  }
};

module.exports = Coupon;