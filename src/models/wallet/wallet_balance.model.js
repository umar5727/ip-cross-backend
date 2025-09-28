const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const WalletBalance = sequelize.define('WalletBalance', {
  wallet_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'wallet_id'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id'
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'balance'
  },
  default_upi_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'default_upi_id'
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
  tableName: 'oc_wallet_balance',
  timestamps: false,
  indexes: [
    {
      fields: ['customer_id']
    }
  ]
});

module.exports = WalletBalance;
