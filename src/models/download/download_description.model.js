const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DownloadDescription = sequelize.define('DownloadDescription', {
    download_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'Download',
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
    tableName: 'download_description',
    timestamps: false
  });

  return DownloadDescription;
};