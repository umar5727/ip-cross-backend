const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductToDownload = sequelize.define('ProductToDownload', {
    product_id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    download_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'Download',
        key: 'download_id'
      }
    }
  }, {
    tableName: 'product_to_download',
    timestamps: false
  });

  return ProductToDownload;
};