const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');
const crypto = require('crypto');

const CustomerAccount = sequelize.define('customer_account', {
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_group_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  language_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
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
  fax: {
    type: DataTypes.STRING(32),
    allowNull: true
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
  address_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  custom_field: {
    type: DataTypes.TEXT,
    allowNull: true
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
    type: DataTypes.TEXT,
    allowNull: true
  },
  code: {
    type: DataTypes.STRING(40),
    allowNull: true
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  profile_image: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  pincode_history: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gstin: {
    type: DataTypes.STRING(15),
    allowNull: true
  }
}, {
  tableName: 'oc_customer',
  timestamps: false
});

// OpenCart password encryption method
CustomerAccount.prototype.encryptPassword = function(password) {
  const salt = this.generateSalt();
  const hash1 = crypto.createHash('sha1').update(password).digest('hex');
  const hash2 = crypto.createHash('sha1').update(salt + hash1).digest('hex');
  const finalHash = crypto.createHash('sha1').update(salt + hash2).digest('hex');
  return { password: finalHash, salt: salt };
};

// Generate random salt
CustomerAccount.prototype.generateSalt = function() {
  return crypto.randomBytes(9).toString('hex').substring(0, 9);
};

// Generate random code for password reset
CustomerAccount.prototype.generateCode = function() {
  return crypto.randomBytes(20).toString('hex');
};

// Verify password using OpenCart method
CustomerAccount.prototype.verifyPassword = function(candidatePassword) {
  if (this.salt) {
    // OpenCart SHA1 method with salt
    const hash1 = crypto.createHash('sha1').update(candidatePassword).digest('hex');
    const hash2 = crypto.createHash('sha1').update(this.salt + hash1).digest('hex');
    const finalHash = crypto.createHash('sha1').update(this.salt + hash2).digest('hex');
    return this.password === finalHash;
  } else {
    // Fallback to MD5 (OpenCart's alternative method)
    const md5Hash = crypto.createHash('md5').update(candidatePassword).digest('hex');
    return this.password === md5Hash;
  }
};

// Static methods for database operations
CustomerAccount.addCustomer = async function(data) {
  const customer = new CustomerAccount();
  const encrypted = customer.encryptPassword(data.password);
  
  return await CustomerAccount.create({
    customer_group_id: data.customer_group_id || 1,
    store_id: data.store_id || 0,
    language_id: data.language_id || 1,
    firstname: data.firstname,
    lastname: data.lastname,
    email: data.email,
    telephone: data.telephone,
    password: encrypted.password,
    salt: encrypted.salt,
    newsletter: data.newsletter || false,
    ip: data.ip,
    status: true,
    safe: true,
    date_added: new Date()
  });
};

CustomerAccount.getCustomerById = async function(customerId) {
  return await CustomerAccount.findByPk(customerId);
};

CustomerAccount.getCustomerByEmail = async function(email) {
  return await CustomerAccount.findOne({ 
    where: { email: email.toLowerCase() } 
  });
};

CustomerAccount.getCustomerByTelephone = async function(telephone) {
  return await CustomerAccount.findOne({ 
    where: { telephone: telephone } 
  });
};

CustomerAccount.getCustomerByCode = async function(code) {
  return await CustomerAccount.findOne({ 
    where: { code: code },
    attributes: ['customer_id', 'firstname', 'lastname', 'email']
  });
};

CustomerAccount.updateCustomer = async function(customerId, data) {
  const customer = await CustomerAccount.findByPk(customerId);
  if (!customer) return null;
  
  return await customer.update({
    firstname: data.firstname || customer.firstname,
    lastname: data.lastname || customer.lastname,
    email: data.email || customer.email,
    telephone: data.telephone || customer.telephone,
    date_modified: new Date()
  });
};

CustomerAccount.updatePassword = async function(email, newPassword) {
  const customer = new CustomerAccount();
  const encrypted = customer.encryptPassword(newPassword);
  
  return await CustomerAccount.update({
    password: encrypted.password,
    salt: encrypted.salt,
    code: '' // Clear reset code after password change
  }, {
    where: { email: email.toLowerCase() }
  });
};

CustomerAccount.setResetCode = async function(email, code) {
  return await CustomerAccount.update({
    code: code
  }, {
    where: { email: email.toLowerCase() }
  });
};

CustomerAccount.updateProfileImage = async function(customerId, imagePath) {
  return await CustomerAccount.update({
    profile_image: imagePath
  }, {
    where: { customer_id: customerId }
  });
};

CustomerAccount.getProfileImage = async function(customerId) {
  const customer = await CustomerAccount.findByPk(customerId, {
    attributes: ['profile_image']
  });
  return customer ? customer.profile_image : null;
};

CustomerAccount.updateNewsletter = async function(customerId, newsletter) {
  return await CustomerAccount.update({
    newsletter: newsletter
  }, {
    where: { customer_id: customerId }
  });
};

CustomerAccount.checkEmailExists = async function(email) {
  const count = await CustomerAccount.count({
    where: { email: email.toLowerCase() }
  });
  return count > 0;
};

// Pincode history methods
CustomerAccount.getPincodeHistory = async function(customerId) {
  try {
    const PincodeHistory = require('./pincode_history.model');
    return await PincodeHistory.getPincodeHistory(customerId);
  } catch (error) {
    console.error('Error in getPincodeHistory:', error);
    throw error;
  }
};

CustomerAccount.addPincodeHistory = async function(customerId, pincode) {
  try {
    const PincodeHistory = require('./pincode_history.model');
    return await PincodeHistory.addPincodeHistory(customerId, pincode);
  } catch (error) {
    console.error('Error in addPincodeHistory:', error);
    throw error;
  }
};

module.exports = CustomerAccount;
