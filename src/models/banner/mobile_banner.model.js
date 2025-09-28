const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const MobileBanner = sequelize.define('MobileBanner', {
  banner_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'banner_id'
  },
  device: {
    type: DataTypes.ENUM('ios', 'android', 'tablet'),
    allowNull: false,
    field: 'device'
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'image'
  },
  link: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'link'
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'status'
  },
  banner_title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'banner_title'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  sequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sequence'
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'date_added'
  },
  date_modified: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'date_modified'
  }
}, {
  tableName: 'oc_mobile_banners',
  timestamps: false,
  indexes: [
    {
      fields: ['device']
    },
    {
      fields: ['status']
    },
    {
      fields: ['sequence']
    }
  ]
});

// Static methods for banner operations
MobileBanner.getBannersByDevice = async function(device) {
  try {
    const banners = await this.findAll({
      where: {
        device: device,
        status: true
      },
      order: [['sequence', 'ASC'], ['date_added', 'DESC']],
      attributes: [
        'banner_id',
        'device',
        'image',
        'link',
        'banner_title',
        'description',
        'sequence',
        'date_added'
      ]
    });

    return banners;
  } catch (error) {
    console.error('Error getting banners by device:', error);
    throw error;
  }
};

MobileBanner.getAllBanners = async function() {
  try {
    const banners = await this.findAll({
      where: {
        status: true
      },
      order: [['device', 'ASC'], ['sequence', 'ASC'], ['date_added', 'DESC']],
      attributes: [
        'banner_id',
        'device',
        'image',
        'link',
        'banner_title',
        'description',
        'sequence',
        'date_added'
      ]
    });

    return banners;
  } catch (error) {
    console.error('Error getting all banners:', error);
    throw error;
  }
};

MobileBanner.getBannerById = async function(bannerId) {
  try {
    const banner = await this.findOne({
      where: {
        banner_id: bannerId,
        status: true
      },
      attributes: [
        'banner_id',
        'device',
        'image',
        'link',
        'banner_title',
        'description',
        'sequence',
        'date_added'
      ]
    });

    return banner;
  } catch (error) {
    console.error('Error getting banner by ID:', error);
    throw error;
  }
};

module.exports = MobileBanner;
