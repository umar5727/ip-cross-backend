const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const VendorToProduct = sequelize.define('vendor_to_product', {
  vendor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  }
}, {
  tableName: 'oc_vendor_to_product',
  timestamps: false
});

module.exports = VendorToProduct;