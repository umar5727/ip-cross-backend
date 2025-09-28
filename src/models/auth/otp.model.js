const { DataTypes, Op } = require('sequelize');
const sequelize = require('../../../config/database');

const OTP = sequelize.define('otp', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phone_number: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      is: {
        args: /^[0-9+\-\s()]+$/,
        msg: 'Please provide a valid phone number'
      }
    }
  },
  otp_code: {
    type: DataTypes.STRING(6),
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'otp_codes',
  timestamps: false,
  indexes: [
    {
      fields: ['phone_number', 'is_used']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Static method to generate OTP
OTP.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create OTP record
OTP.createOTP = async function(phoneNumber) {
  // Clean up old OTPs for this phone number
  await OTP.destroy({
    where: {
      phone_number: phoneNumber,
      is_used: true
    }
  });

  // Delete expired OTPs
  await OTP.destroy({
    where: {
      expires_at: {
        [Op.lt]: new Date()
      }
    }
  });

  const otpCode = OTP.generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  return await OTP.create({
    phone_number: phoneNumber,
    otp_code: otpCode,
    expires_at: expiresAt
  });
};

// Static method to verify OTP
OTP.verifyOTP = async function(phoneNumber, otpCode) {
  const otpRecord = await OTP.findOne({
    where: {
      phone_number: phoneNumber,
      otp_code: otpCode,
      is_used: false,
      expires_at: {
        [Op.gt]: new Date()
      }
    }
  });

  if (!otpRecord) {
    // Increment attempts for any existing OTP for this phone number
    await OTP.increment('attempts', {
      where: {
        phone_number: phoneNumber,
        is_used: false
      }
    });
    return { valid: false, message: 'Invalid or expired OTP' };
  }

  // Mark OTP as used
  await otpRecord.update({ is_used: true });

  return { valid: true, message: 'OTP verified successfully' };
};

// Static method to check if phone number has too many attempts
OTP.checkAttempts = async function(phoneNumber) {
  const recentAttempts = await OTP.count({
    where: {
      phone_number: phoneNumber,
      created_at: {
        [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      }
    }
  });

  return recentAttempts < 5; // Max 5 attempts in 15 minutes
};

module.exports = OTP;
