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
        // Generate a random salt (OpenCart style)
        const salt = Array(9).fill(0).map(() => Math.random().toString(36).charAt(2)).join('');
        customer.salt = salt;
        // Hash password with salt (OpenCart style: sha1(salt + sha1(salt + sha1(password))))
        customer.password = require('crypto')
          .createHash('sha1')
          .update(salt + require('crypto').createHash('sha1').update(salt + require('crypto').createHash('sha1').update(customer.password).digest('hex')).digest('hex'))
          .digest('hex');
      }
    },
    beforeUpdate: async (customer) => {
      if (customer.changed('password')) {
        // Generate a random salt (OpenCart style)
        const salt = Array(9).fill(0).map(() => Math.random().toString(36).charAt(2)).join('');
        customer.salt = salt;
        // Hash password with salt (OpenCart style: sha1(salt + sha1(salt + sha1(password))))
        customer.password = require('crypto')
          .createHash('sha1')
          .update(salt + require('crypto').createHash('sha1').update(salt + require('crypto').createHash('sha1').update(customer.password).digest('hex')).digest('hex'))
          .digest('hex');
      }
    }
  }
});

// Instance method to check password using OpenCart's salt method
Customer.prototype.comparePassword = async function(candidatePassword) {
  // OpenCart style password verification: sha1(salt + sha1(salt + sha1(password)))
  const hash = require('crypto')
    .createHash('sha1')
    .update(this.salt + require('crypto').createHash('sha1').update(this.salt + require('crypto').createHash('sha1').update(candidatePassword).digest('hex')).digest('hex'))
    .digest('hex');
  
  return hash === this.password;
};

module.exports = Customer;