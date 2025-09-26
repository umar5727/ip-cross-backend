const express = require('express');
const RewardController = require('../controllers/referral/reward.controller');

const router = express.Router();

/**
 * @route GET /api/rewards
 * @desc Get customer rewards with pagination
 * @access Private (requires x-customer-id header)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 * @query {string} sort - Sort field (points, description, date_added, order_id)
 * @query {string} order - Sort order (ASC, DESC)
 */
router.get('/', RewardController.getCustomerRewards);

/**
 * @route GET /api/rewards/total
 * @desc Get customer's total reward points
 * @access Private (requires x-customer-id header)
 */
router.get('/total', RewardController.getTotalRewardPoints);

/**
 * @route GET /api/rewards/stats
 * @desc Get reward statistics for a customer
 * @access Private (requires x-customer-id header)
 */
router.get('/stats', RewardController.getRewardStats);

/**
 * @route GET /api/rewards/order/:orderId
 * @desc Get reward history for a specific order
 * @access Private (requires x-customer-id header)
 * @param {number} orderId - Order ID
 */
router.get('/order/:orderId', RewardController.getRewardsByOrder);

/**
 * @route POST /api/rewards
 * @desc Add reward points for a customer
 * @access Private (requires x-customer-id header)
 * @body {number} order_id - Order ID (optional, default: 0)
 * @body {string} description - Reward description (required)
 * @body {number} points - Points to add (required, can be negative)
 */
router.post('/', RewardController.addRewardPoints);

module.exports = router;