const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');


const OrderVendorHistory = sequelize.define('OrderVendorHistory', {
  order_vendorhistory_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  order_status_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  order_product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date_added: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_order_vendorhistory',
  timestamps: false
});

module.exports = OrderVendorHistory;