const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');
const bcrypt = require('bcryptjs');

const Customer = sequelize.define('customer', {
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_group_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  firstname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  lastname: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(96),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  telephone: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  salt: {
    type: DataTypes.STRING(9),
    allowNull: true
  },
  cart: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  wishlist: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  newsletter: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  ip: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  safe: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_customer',
  timestamps: false,
  hooks: {
    beforeCreate: async (customer) => {
      if (customer.password) {
        const salt = await bcrypt.genSalt(10);
        customer.password = await bcrypt.hash(customer.password, salt);
      }
    },
    beforeUpdate: async (customer) => {
      if (customer.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        customer.password = await bcrypt.hash(customer.password, salt);
      }
    }
  }
});

// Instance method to check password
Customer.prototype.comparePassword = async function(candidatePassword) {
  // Use bcrypt to compare password since we're hashing with bcrypt in hooks
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = Customer;