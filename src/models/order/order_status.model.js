const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const OrderStatus = sequelize.define('order_status', {
  order_status_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  language_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  name: {
    type: DataTypes.STRING(32),
    allowNull: false
  }
}, {
  tableName: 'oc_order_status',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['order_status_id', 'language_id']
    }
  ]
});

module.exports = OrderStatus;
