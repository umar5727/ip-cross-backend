const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const customerAccountController = require('../controllers/customer/customer_account.controller');
const { protect } = require('../middleware/auth.middleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Public routes (no authentication required)
router.post('/register', customerAccountController.register);
router.post('/forgot-password', customerAccountController.forgotPassword);
router.post('/reset-password', customerAccountController.resetPassword);

// Protected routes (authentication required)
router.use(protect); // All routes below this line require authentication

// Profile management
router.get('/profile', customerAccountController.getProfile);
router.put('/profile', customerAccountController.updateProfile);
router.delete('/account', customerAccountController.deleteAccount);

// Password management
router.put('/change-password', customerAccountController.changePassword);

// Profile image management
router.post('/upload-image', upload.single('profile_image'), customerAccountController.uploadProfileImage);
router.get('/profile-image', customerAccountController.getProfileImage);

// Newsletter subscription
router.put('/newsletter', customerAccountController.updateNewsletter);

// Pincode history (for delivery tracking)
router.get('/pincode-history', customerAccountController.getPincodeHistory);
router.post('/pincode-history', customerAccountController.addPincodeHistory);

module.exports = router;
