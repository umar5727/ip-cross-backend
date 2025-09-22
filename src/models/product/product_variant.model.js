const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ProductVariant = sequelize.define('product_variant', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'product',
      key: 'product_id'
    }
  },
  variant_group_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  variant_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  variant_image: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'oc_product_variants',
  timestamps: false
});

module.exports = ProductVariant;