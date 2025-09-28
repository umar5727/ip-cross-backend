const { RewardModel } = require('../../models/referral/reward.model');

class RewardController {
  /**
   * Get customer rewards with pagination
   * GET /api/rewards
   * Headers: x-customer-id
   * Query params: page, limit, sort, order
   */
  static async getCustomerRewards(req, res) {
    try {
      const customerId = req.customer?.customer_id;
      
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const {
        page = 1,
        limit = 10,
        sort = 'date_added',
        order = 'DESC'
      } = req.query;

      const result = await RewardModel.getCustomerRewards(customerId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        order
      });

      // Format the response similar to PHP version
      const formattedRewards = result.rewards.map(reward => ({
        customer_reward_id: reward.customer_reward_id,
        order_id: reward.order_id,
        points: reward.points,
        description: reward.description,
        date_added: reward.date_added
      }));

      return res.status(200).json({
        success: true,
        data: {
          rewards: formattedRewards,
          pagination: result.pagination,
          total_points: await RewardModel.getTotalRewardPoints(customerId)
        }
      });

    } catch (error) {
      console.error('Error in getCustomerRewards:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get customer's total reward points
   * GET /api/rewards/total
   * Headers: x-customer-id
   */
  static async getTotalRewardPoints(req, res) {
    try {
      const customerId = req.customer?.customer_id;
      
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const totalPoints = await RewardModel.getTotalRewardPoints(customerId);

      return res.status(200).json({
        success: true,
        data: {
          customer_id: parseInt(customerId),
          total_points: totalPoints
        }
      });

    } catch (error) {
      console.error('Error in getTotalRewardPoints:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Add reward points for a customer
   * POST /api/rewards
   * Headers: x-customer-id
   * Body: { order_id?, description, points }
   */
  static async addRewardPoints(req, res) {
    try {
      const customerId = req.customer?.customer_id;
      
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { order_id = 0, description, points } = req.body;

      // Validation
      if (!description || points === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Description and points are required'
        });
      }

      if (typeof points !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Points must be a number'
        });
      }

      const reward = await RewardModel.addRewardPoints(
        customerId,
        order_id,
        description,
        points
      );

      return res.status(201).json({
        success: true,
        message: 'Reward points added successfully',
        data: reward
      });

    } catch (error) {
      console.error('Error in addRewardPoints:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get reward history for a specific order
   * GET /api/rewards/order/:orderId
   * Headers: x-customer-id
   */
  static async getRewardsByOrder(req, res) {
    try {
      const customerId = req.customer?.customer_id;
      const { orderId } = req.params;
      
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!orderId || isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid order ID is required'
        });
      }

      const rewards = await RewardModel.getRewardsByOrder(customerId, parseInt(orderId));

      return res.status(200).json({
        success: true,
        data: {
          order_id: parseInt(orderId),
          rewards: rewards
        }
      });

    } catch (error) {
      console.error('Error in getRewardsByOrder:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get reward statistics for a customer
   * GET /api/rewards/stats
   * Headers: x-customer-id
   */
  static async getRewardStats(req, res) {
    try {
      const customerId = req.customer?.customer_id;
      
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const [totalPoints, totalEntries] = await Promise.all([
        RewardModel.getTotalRewardPoints(customerId),
        RewardModel.getTotalRewardEntries(customerId)
      ]);

      return res.status(200).json({
        success: true,
        data: {
          customer_id: parseInt(customerId),
          total_points: totalPoints,
          total_entries: totalEntries,
          average_points_per_entry: totalEntries > 0 ? Math.round(totalPoints / totalEntries * 100) / 100 : 0
        }
      });

    } catch (error) {
      console.error('Error in getRewardStats:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = RewardController;