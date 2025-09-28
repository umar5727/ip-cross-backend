const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ReturnImage = sequelize.define('ReturnImage', {
  return_image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'return_image_id'
  },
  return_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'return_id'
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'image'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order'
  }
}, {
  tableName: 'oc_return_image',
  timestamps: false,
  indexes: [
    {
      fields: ['return_id']
    }
  ]
});

module.exports = ReturnImage;
