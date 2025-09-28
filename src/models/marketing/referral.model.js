/**
 * Referral Model
 * Handles referral data and operations
 */

const { DataTypes } = require('sequelize');
const db = require('../../../config/database');

const Referral = db.define('oc_referral', {
  referral_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  commission_type: {
    type: DataTypes.CHAR(1), // F = Fixed Amount, P = Percentage
    allowNull: false,
    defaultValue: 'P'
  },
  commission_value: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 5.0000
  },
  uses: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  max_uses: {
    type: DataTypes.INTEGER,
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
  tableName: 'referral',
  timestamps: false
});

/**
 * Get referral by code
 * @param {string} code - Referral code
 * @returns {Promise<Object|null>} Referral data or null if not found
 */
Referral.getReferral = async function(code) {
  if (!code) return null;
  
  const now = new Date();
  
  try {
    const referral = await Referral.findOne({
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
        ],
        [db.Sequelize.Op.or]: [
          { max_uses: null },
          { uses: { [db.Sequelize.Op.lt]: db.col('max_uses') } }
        ]
      }
    });
    
    return referral ? referral.toJSON() : null;
  } catch (error) {
    console.error('Error getting referral:', error);
    return null;
  }
};

/**
 * Increment the usage count for a referral
 * @param {number} referral_id - Referral ID
 * @returns {Promise<boolean>} Success status
 */
Referral.incrementUsage = async function(referral_id) {
  try {
    await Referral.update(
      { uses: db.literal('uses + 1') },
      { where: { referral_id } }
    );
    return true;
  } catch (error) {
    console.error('Error incrementing referral usage:', error);
    return false;
  }
};

/**
 * Generate a unique referral code for a customer
 * @param {number} customer_id - Customer ID
 * @returns {Promise<string>} Generated referral code
 */
Referral.generateCode = async function(customer_id) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Check if code already exists
    const existingCode = await Referral.findOne({ where: { code } });
    if (!existingCode) {
      isUnique = true;
    }
  }
  
  return code;
};

module.exports = Referral;