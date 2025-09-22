const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ProductSpecial = sequelize.define('product_special', {
  product_special_id: {
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
  customer_group_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    comment: 'Selling price'
  },
  date_start: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00'
  },
  date_end: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00'
  }
}, {
  tableName: 'oc_product_special',
  timestamps: false
});

module.exports = ProductSpecial;