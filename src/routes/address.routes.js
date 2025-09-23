const express = require('express');
const router = express.Router();
const addressController = require('../controllers/customer/address.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Address CRUD operations
router.get('/', addressController.getAddresses);
router.get('/total', addressController.getTotalAddresses);
router.get('/countries', addressController.getCountries);
router.get('/zones/:countryId', addressController.getZonesByCountry);
router.get('/default', addressController.getDefaultAddress);
router.get('/check-default', addressController.checkDefaultAddressStatus);
router.post('/', addressController.addAddress);
router.get('/:addressId', addressController.getAddress);
router.put('/:addressId', addressController.updateAddress);
router.delete('/:addressId', addressController.deleteAddress);
router.put('/:addressId/set-default', addressController.setDefaultAddress);

module.exports = router;
