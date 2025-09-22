const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Cart = sequelize.define('cart', {
  cart_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  api_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  customer_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  session_id: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recurring_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  option: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  date_added: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_cart',
  timestamps: false,
  indexes: [
    {
      name: 'cart_customer_session_idx',
      fields: ['customer_id', 'session_id']
    },
    {
      name: 'cart_product_idx',
      fields: ['product_id']
    }
  ]
});

module.exports = Cart;