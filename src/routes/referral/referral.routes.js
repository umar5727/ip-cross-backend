const express = require('express');
const router = express.Router();
const referralController = require('../../controllers/referral/referral.controller');
const { protect, optionalAuth } = require('../../middleware/auth.middleware');

/**
 * @route GET /api/referral/validate/:referralCode
 * @desc Validate referral code (public endpoint)
 * @access Public
 */
router.get('/validate/:referralCode', referralController.validateReferralCode.bind(referralController));

/**
 * @route GET /api/referral/form
 * @desc Get referral form data and existing referral if any
 * @access Public (with optional customer data if authenticated)
 */
router.get('/form', optionalAuth, referralController.getReferralForm.bind(referralController));

// Apply customer authentication middleware to protected referral routes
router.use(protect);

/**
 * @route POST /api/referral/create
 * @desc Create or get existing referral
 * @access Private (Customer)
 */
router.post('/create', referralController.createReferral.bind(referralController));

/**
 * @route GET /api/referral/my-referrals
 * @desc Get customer's referrals
 * @access Private (Customer)
 */
router.get('/my-referrals', referralController.getCustomerReferrals.bind(referralController));

/**
 * @route GET /api/referral/referred-buyers
 * @desc Get referred buyers (customers who bought through referral)
 * @access Private (Customer)
 */
router.get('/referred-buyers', referralController.getReferredBuyers.bind(referralController));

/**
 * @route PUT /api/referral/:referralId/status
 * @desc Update referral status
 * @access Private (Customer)
 */
router.put('/:referralId/status', referralController.updateReferralStatus.bind(referralController));

/**
 * @route DELETE /api/referral/:referralId
 * @desc Delete referral
 * @access Private (Customer)
 */
router.delete('/:referralId', referralController.deleteReferral.bind(referralController));

module.exports = router;