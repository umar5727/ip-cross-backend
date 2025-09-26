const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
    tableName: 'download',
    timestamps: false
  });

  return Download;
};