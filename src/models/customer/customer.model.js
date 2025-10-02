const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');
const crypto = require('crypto');

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
    allowNull: false,
    unique: true,
    validate: {
      is: {
        args: /^[0-9+\-\s()]+$/,
        msg: 'Please provide a valid phone number'
      },
      len: {
        args: [10, 15],
        msg: 'Phone number must be between 10 and 15 characters'
      }
    }
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
  },
    address_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'address_id',
    references: {
      model: 'oc_address',
      key: 'address_id'
    }
  }
}, {
  tableName: 'oc_customer',
  timestamps: false,
  hooks: {
    beforeCreate: async (customer) => {
      if (customer.password) {
        // Generate a 9-character salt (like OpenCart)
        const salt = crypto.randomBytes(9).toString('hex').substring(0, 9);
        customer.salt = salt;
        // Use OpenCart's password format: sha1(salt + sha1(salt + sha1(password)))
        const sha1Password = crypto.createHash('sha1').update(customer.password).digest('hex');
        const sha1SaltPassword = crypto.createHash('sha1').update(salt + sha1Password).digest('hex');
        customer.password = crypto.createHash('sha1').update(salt + sha1SaltPassword).digest('hex');
      }
    },
    beforeUpdate: async (customer) => {
      if (customer.changed('password')) {
        // Generate a 9-character salt (like OpenCart)
        const salt = crypto.randomBytes(9).toString('hex').substring(0, 9);
        customer.salt = salt;
        // Use OpenCart's password format: sha1(salt + sha1(salt + sha1(password)))
        const sha1Password = crypto.createHash('sha1').update(customer.password).digest('hex');
        const sha1SaltPassword = crypto.createHash('sha1').update(salt + sha1Password).digest('hex');
        customer.password = crypto.createHash('sha1').update(salt + sha1SaltPassword).digest('hex');
      }
    }
  }
});

// Instance method to check password using OpenCart's format
Customer.prototype.comparePassword = async function(candidatePassword) {
  // Use OpenCart's password validation: SHA1(CONCAT(salt, SHA1(CONCAT(salt, SHA1('password')))))
  const sha1Password = crypto.createHash('sha1').update(candidatePassword).digest('hex');
  const sha1SaltPassword = crypto.createHash('sha1').update(this.salt + sha1Password).digest('hex');
  const hashedPassword = crypto.createHash('sha1').update(this.salt + sha1SaltPassword).digest('hex');
  
  return hashedPassword === this.password;
};

module.exports = Customer;