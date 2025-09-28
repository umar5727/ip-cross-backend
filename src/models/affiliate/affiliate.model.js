/**
 * Affiliate Model
 * Handles affiliate data and operations
 */

const { DataTypes } = require('sequelize');
const db = require('../../../config/database');

const Affiliate = db.define('oc_affiliate', {
  affiliate_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  lastname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(96),
    allowNull: false,
    unique: true
  },
  telephone: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  commission: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 5.00
  },
  tax_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING(6),
    allowNull: false,
    defaultValue: 'bank'
  },
  bank_name: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  bank_branch_number: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  bank_swift_code: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  bank_account_name: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  bank_account_number: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  date_added: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'affiliate',
  timestamps: false
});

/**
 * Get affiliate by code
 * @param {string} code - Affiliate code
 * @returns {Promise<Object|null>} Affiliate data or null if not found
 */
Affiliate.getAffiliate = async function(code) {
  if (!code) return null;
  
  try {
    const affiliate = await Affiliate.findOne({
      where: {
        code: code,
        status: true
      }
    });
    
    return affiliate ? affiliate.toJSON() : null;
  } catch (error) {
    console.error('Error getting affiliate:', error);
    return null;
  }
};

/**
 * Get affiliate by ID
 * @param {number} affiliate_id - Affiliate ID
 * @returns {Promise<Object|null>} Affiliate data or null if not found
 */
Affiliate.getAffiliateById = async function(affiliate_id) {
  if (!affiliate_id) return null;
  
  try {
    const affiliate = await Affiliate.findOne({
      where: {
        affiliate_id: affiliate_id,
        status: true
      }
    });
    
    return affiliate ? affiliate.toJSON() : null;
  } catch (error) {
    console.error('Error getting affiliate by ID:', error);
    return null;
  }
};

module.exports = Affiliate;