const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');


const Order = sequelize.define('order', {
  order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoice_no: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  invoice_prefix: {
    type: DataTypes.STRING(26),
    allowNull: false
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  store_name: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  store_url: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  customer_group_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
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
    allowNull: false
  },
  telephone: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  payment_firstname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  payment_lastname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  payment_address_1: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  payment_address_2: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  payment_city: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  payment_postcode: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  payment_country: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  payment_country_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  payment_zone: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  payment_zone_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  payment_method: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  payment_code: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  shipping_firstname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  shipping_lastname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  shipping_address_1: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  shipping_address_2: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  shipping_city: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  shipping_postcode: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  shipping_country: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  shipping_country_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  shipping_zone: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  shipping_zone_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  shipping_method: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  shipping_code: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  total: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  },
  order_status_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  ip: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false
  },
  date_modified: {
    type: DataTypes.DATE,
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  language_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  currency_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  currency_code: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  currency_value: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: false,
    defaultValue: 1.00000000
  },
  awbno: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  total_courier_charges: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: true,
    defaultValue: 0.0000
  },
  affiliate_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  commission: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  },
  marketing_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  tracking: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  forwarded_ip: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  user_agent: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  accept_language: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'oc_order',
  timestamps: false
});

module.exports = Order;