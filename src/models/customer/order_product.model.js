const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const OrderProduct = sequelize.define('order_product', {
  order_product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
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
  tax: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  }
}, {
  tableName: 'oc_order_product',
  timestamps: false
});

module.exports = OrderProduct;