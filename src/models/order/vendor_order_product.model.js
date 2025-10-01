const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');


const VendorOrderProduct = sequelize.define('vendor_order_product', {
  order_product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  order_product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  model: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  },
  total: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  },
  rewards: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  order_status_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  date_modified: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_vendor_order_product',
  timestamps: false,
  id: false // Disable default id field
});


module.exports = VendorOrderProduct;