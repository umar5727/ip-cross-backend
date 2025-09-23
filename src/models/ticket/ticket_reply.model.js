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
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  file: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Uploaded file name for reply'
  },
  user_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'customer'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
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
      fields: ['sender_type', 'sender_id']
    }
  ]
});

module.exports = TicketReply;