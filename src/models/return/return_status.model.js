const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ReturnStatus = sequelize.define('ReturnStatus', {
  return_status_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'return_status_id'
  },
  language_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'language_id'
  },
  name: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'name'
  }
}, {
  tableName: 'oc_return_status',
  timestamps: false,
  indexes: [
    {
      fields: ['language_id']
    }
  ]
});

module.exports = ReturnStatus;
