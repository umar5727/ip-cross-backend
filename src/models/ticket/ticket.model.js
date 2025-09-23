const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Ticket = sequelize.define('Ticket', {
  ticket_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'customer_id'
    }
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(32),
    defaultValue: 'open'
  },
  file: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: ''
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'oc_customer_ticket',
  timestamps: false,
  indexes: [
    {
      fields: ['customer_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['category']
    }
  ]
});

module.exports = Ticket;