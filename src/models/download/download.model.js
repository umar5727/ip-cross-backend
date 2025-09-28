const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

// Define the Download model using existing OpenCart table
const Download = sequelize.define('Download', {
  download_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING(160),
    allowNull: false
  },
  mask: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_download', // Use existing OpenCart table
  timestamps: false
});

module.exports = Download;