const CustomerAccount = require('../../models/customer/customer_account.model');
const { redisClient } = require('../../../config/redis');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Register a new customer
exports.register = async (req, res) => {
  try {
    const { firstname, lastname, email, telephone, password, newsletter } = req.body;

    // Validate required fields
    if (!firstname || !lastname || !email || !telephone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate telephone format
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(telephone) || telephone.length < 10 || telephone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (10-15 digits)'
      });
    }

    // Check if email already exists
    const emailExists = await CustomerAccount.checkEmailExists(email);
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if telephone already exists
    const existingCustomerByPhone = await CustomerAccount.getCustomerByTelephone(telephone);
    if (existingCustomerByPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    // Create new customer
    const customer = await CustomerAccount.addCustomer({
      firstname,
      lastname,
      email,
      telephone,
      password,
      newsletter: newsletter || false,
      ip: req.ip
    });

    // Remove password from response
    const { password: _, salt: __, ...customerData } = customer.toJSON();

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: customerData
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      if (field === 'email') {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      } else if (field === 'telephone') {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      const validationError = error.errors[0];
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Could not register customer'
    });
  }
};

// Get customer profile
exports.getProfile = async (req, res) => {
  try {
    const customer = await CustomerAccount.getCustomerById(req.customer.customer_id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Remove sensitive data from response
    const { password: _, salt: __, code: ___, ...customerData } = customer.toJSON();

    res.status(200).json({
      success: true,
      data: customerData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get profile'
    });
  }
};

// Update customer profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstname, lastname, email, telephone } = req.body;
    const customerId = req.customer.customer_id;

    // Check if email is being changed and if it already exists
    if (email) {
      const existingCustomer = await CustomerAccount.getCustomerByEmail(email);
      if (existingCustomer && existingCustomer.customer_id !== customerId) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Check if telephone is being changed and if it already exists
    if (telephone) {
      // Validate telephone format
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (!phoneRegex.test(telephone) || telephone.length < 10 || telephone.length > 15) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid phone number (10-15 digits)'
        });
      }

      const existingCustomerByPhone = await CustomerAccount.getCustomerByTelephone(telephone);
      if (existingCustomerByPhone && existingCustomerByPhone.customer_id !== customerId) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }

    // Update customer
    const updatedCustomer = await CustomerAccount.updateCustomer(customerId, {
      firstname,
      lastname,
      email,
      telephone
    });

    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Remove sensitive data from response
    const { password: _, salt: __, code: ___, ...customerData } = updatedCustomer.toJSON();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: customerData
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      if (field === 'email') {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      } else if (field === 'telephone') {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      const validationError = error.errors[0];
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Could not update profile'
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const customerId = req.customer.customer_id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Get customer with password
    const customer = await CustomerAccount.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = customer.verifyPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    await CustomerAccount.updatePassword(customer.email, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not change password'
    });
  }
};

// Forgot password - send reset code
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if customer exists
    const customer = await CustomerAccount.getCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Generate reset code
    const resetCode = crypto.randomBytes(20).toString('hex');
    
    // Save reset code to database
    await CustomerAccount.setResetCode(email, resetCode);

    // In a real application, you would send this code via email
    // For now, we'll return it in the response for testing
    res.status(200).json({
      success: true,
      message: 'Reset code sent to your email',
      resetCode: resetCode // Remove this in production
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not process forgot password request'
    });
  }
};

// Reset password with code
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required'
      });
    }

    // Verify reset code
    const customer = await CustomerAccount.getCustomerByCode(code);
    if (!customer || customer.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code or email'
      });
    }

    // Update password
    await CustomerAccount.updatePassword(email, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not reset password'
    });
  }
};

// Upload profile image
exports.uploadProfileImage = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Create customer images directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../../uploads/customer_images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const filename = `profile_${customerId}_${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);

    // Move file to uploads directory
    fs.renameSync(req.file.path, filePath);

    // Update database with image path
    const relativePath = `customer_images/${filename}`;
    await CustomerAccount.updateProfileImage(customerId, relativePath);

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        imagePath: relativePath,
        imageUrl: `/uploads/${relativePath}`
      }
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not upload profile image'
    });
  }
};

// Get profile image
exports.getProfileImage = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const imagePath = await CustomerAccount.getProfileImage(customerId);

    if (!imagePath) {
      return res.status(200).json({
        success: true,
        message: 'No profile image uploaded yet',
        data: {
          imagePath: null,
          imageUrl: null,
          hasImage: false
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        imagePath: imagePath,
        imageUrl: `/uploads/${imagePath}`,
        hasImage: true
      }
    });
  } catch (error) {
    console.error('Get profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get profile image'
    });
  }
};

// Update newsletter subscription
exports.updateNewsletter = async (req, res) => {
  try {
    const { newsletter } = req.body;
    const customerId = req.customer.customer_id;

    if (typeof newsletter !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Newsletter subscription status must be true or false'
      });
    }

    await CustomerAccount.updateNewsletter(customerId, newsletter);

    res.status(200).json({
      success: true,
      message: 'Newsletter subscription updated successfully'
    });
  } catch (error) {
    console.error('Update newsletter error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update newsletter subscription'
    });
  }
};

// Get pincode history
exports.getPincodeHistory = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    
    // Direct database operation
    const PincodeHistory = require('../../models/customer/pincode_history.model');
    const pincodes = await PincodeHistory.getPincodeHistory(customerId);
    
    res.status(200).json({
      success: true,
      data: {
        pincodes: pincodes
      }
    });
  } catch (error) {
    console.error('Get pincode history error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get pincode history'
    });
  }
};

// Add pincode to history
exports.addPincodeHistory = async (req, res) => {
  try {
    const { pincode } = req.body;
    const customerId = req.customer.customer_id;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required'
      });
    }

    // Validate pincode format (basic validation)
    if (!/^\d{5,6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Pincode must be 5-6 digits'
      });
    }
    
    // Convert pincode to integer
    const pincodeInt = parseInt(pincode, 10);
    
    // Direct database operation
    const PincodeHistory = require('../../models/customer/pincode_history.model');
    await PincodeHistory.addPincodeHistory(customerId, pincodeInt);

    res.status(200).json({
      success: true,
      message: 'Pincode added to history successfully'
    });
  } catch (error) {
    console.error('Add pincode history error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not add pincode to history'
    });
  }
};

// Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const customerId = req.customer.customer_id;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    // Get customer and verify password
    const customer = await CustomerAccount.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const isPasswordValid = customer.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Delete customer account
    await customer.destroy();

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not delete account'
    });
  }
};
