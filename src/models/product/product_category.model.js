const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ProductCategory = sequelize.define('product_category', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    references: {
      model: 'oc_product',
      key: 'product_id'
    }
  },
  category_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    references: {
      model: 'oc_category',
      key: 'category_id'
    }
  }
}, {
  tableName: 'oc_product_to_category',
  timestamps: false
});

module.exports = ProductCategory;