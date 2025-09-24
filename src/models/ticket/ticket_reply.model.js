const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const TicketReply = sequelize.define('TicketReply', {
  reply_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticket_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'oc_customer_ticket',
      key: 'ticket_id'
    }
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  file: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null
  },
  user_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'customer'
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'oc_customer_ticket_reply',
  timestamps: false,
  indexes: [
    {
      fields: ['ticket_id']
    },
    {
      fields: ['customer_id']
    }
  ]
});

module.exports = TicketReply;