const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

// Define the ProductToDownload model using existing OpenCart table
const ProductToDownload = sequelize.define('ProductToDownload', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  download_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'oc_download',
      key: 'download_id'
    }
  }
}, {
  tableName: 'oc_product_to_download', // Use existing OpenCart table
  timestamps: false
});

module.exports = ProductToDownload;