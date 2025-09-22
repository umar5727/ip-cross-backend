const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ProductImage = sequelize.define('product_image', {
  product_image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product',
      key: 'product_id'
    }
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'oc_product_image',
  timestamps: false
});

module.exports = ProductImage;