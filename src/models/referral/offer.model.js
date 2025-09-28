const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Offer = sequelize.define('Offer', {
  ipoffer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'ipoffer_id'
  },
  offer_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'offer_name'
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'percentage'
  },
  offer_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'offer_type'
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    field: 'status'
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
  tableName: 'oc_ipoffer',
  timestamps: false,
  indexes: [
    {
      fields: ['offer_type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['start_date', 'end_date']
    }
  ]
});

module.exports = Offer;