const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const CategoryDescription = sequelize.define('category_description', {
  category_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'category',
      key: 'category_id'
    }
  },
  language_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  meta_title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  meta_description: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  meta_keyword: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'oc_category_description',
  timestamps: false
});

module.exports = CategoryDescription;