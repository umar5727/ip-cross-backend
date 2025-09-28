const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Return = sequelize.define('Return', {
  return_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'return_id'
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'order_id'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id'
  },
  firstname: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'firstname'
  },
  lastname: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'lastname'
  },
  email: {
    type: DataTypes.STRING(96),
    allowNull: false,
    field: 'email'
  },
  telephone: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'telephone'
  },
  product: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product'
  },
  model: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'model'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'quantity'
  },
  opened: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    field: 'opened'
  },
  return_reason_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'return_reason_id'
  },
  return_action_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'return_action_id'
  },
  return_status_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'return_status_id'
  },
  order_status_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'order_status_id'
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'comment'
  },
  date_ordered: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'date_ordered'
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
  }
}, {
  tableName: 'oc_return',
  timestamps: false,
  indexes: [
    {
      fields: ['customer_id']
    },
    {
      fields: ['order_id']
    },
    {
      fields: ['return_status_id']
    }
  ]
});

module.exports = Return;
