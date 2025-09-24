const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Referral = sequelize.define('Referral', {
  referral_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'referral_id'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id'
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'customer_name'
  },
  customer_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'customer_email'
  },
  refer_code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    field: 'refer_code'
  },
  refer_link: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'refer_link'
  },
  status: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0,
    field: 'status'
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'date_added'
  },
  date_modified: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'date_modified'
  },
  visit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'visit'
  },
  conversion: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0,
    field: 'conversion'
  },
  earned: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000,
    field: 'earned'
  },
  referrer_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'referrer_name'
  },
  referrer_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'referrer_email'
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'order_id'
  },
  order_total: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000,
    field: 'order_total'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  is_expired: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0,
    field: 'is_expired'
  }
}, {
  tableName: 'oc_ipoffer_referral_customers',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['refer_code']
    },
    {
      fields: ['customer_id']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Referral;