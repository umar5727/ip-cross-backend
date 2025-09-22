const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ProductDescription = sequelize.define('product_description', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'product',
      key: 'product_id'
    }
  },
  language_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tag: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  meta_title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  meta_description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  meta_keyword: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'oc_product_description',
  timestamps: false
});

module.exports = ProductDescription;