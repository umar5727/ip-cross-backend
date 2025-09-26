const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const Vendor = sequelize.define('vendor', {
  vendor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstname: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  lastname: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  display_name: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  email: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  image: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  telephone: {
    type: DataTypes.STRING(12),
    allowNull: false
  },
  salt: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  gstin: {
    type: DataTypes.STRING(15),
    allowNull: false
  },
  about: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  company: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  postcode: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  address_1: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  address_2: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  country_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  city: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  map_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  facebook_url: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'oc_vendor',
  timestamps: false
});

// Static methods for vendor operations
Vendor.getVendorByProductId = async function(productId) {
  const query = `
    SELECT v.vendor_id, v.postcode, v.city, v.zone_id, z.name as zone_name
    FROM oc_vendor_to_product vp
    LEFT JOIN oc_vendor v ON vp.vendor_id = v.vendor_id
    LEFT JOIN oc_zone z ON v.zone_id = z.zone_id
    WHERE vp.product_id = :productId
    LIMIT 1
  `;
  
  const [results] = await sequelize.query(query, {
    replacements: { productId },
    type: sequelize.QueryTypes.SELECT
  });
  
  return results;
};

Vendor.getVendorPincode = async function(productId) {
  const vendor = await this.getVendorByProductId(productId);
  return vendor ? vendor.postcode : null;
};

module.exports = Vendor;
