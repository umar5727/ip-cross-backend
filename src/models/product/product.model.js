const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Product = sequelize.define('product', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  model: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  upc: {
    type: DataTypes.STRING(12),
    allowNull: true
  },
  ean: {
    type: DataTypes.STRING(14),
    allowNull: true
  },
  jan: {
    type: DataTypes.STRING(13),
    allowNull: true
  },
  isbn: {
    type: DataTypes.STRING(17),
    allowNull: true
  },
  mpn: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  stock_status_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  manufacturer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  shipping: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  price: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0.0000
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  tax_class_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  date_available: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  weight: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: false,
    defaultValue: 0.00000000
  },
  weight_class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  length: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: false,
    defaultValue: 0.00000000
  },
  width: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: false,
    defaultValue: 0.00000000
  },
  height: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: false,
    defaultValue: 0.00000000
  },
  length_class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  subtract: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  minimum: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  viewed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  date_modified: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_product',
  timestamps: false
});

module.exports = Product;