const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ReturnReason = sequelize.define('ReturnReason', {
  return_reason_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'return_reason_id'
  },
  language_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'language_id'
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'name'
  }
}, {
  tableName: 'oc_return_reason',
  timestamps: false,
  indexes: [
    {
      fields: ['language_id']
    }
  ]
});

module.exports = ReturnReason;
