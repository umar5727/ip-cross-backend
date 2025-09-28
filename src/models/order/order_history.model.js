const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');


const OrderHistory = sequelize.define('order_history', {
  order_history_id: {
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
  notify: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_order_history',
  timestamps: false
});

module.exports = OrderHistory;