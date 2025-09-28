const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

// Define the DownloadDescription model using existing OpenCart table
const DownloadDescription = sequelize.define('DownloadDescription', {
  download_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'oc_download',
      key: 'download_id'
    }
  },
  language_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(64),
    allowNull: false
  }
}, {
  tableName: 'oc_download_description', // Use existing OpenCart table
  timestamps: false
});

module.exports = DownloadDescription;