const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

// Define the CustomerReward model
const CustomerReward = sequelize.define('CustomerReward', {
  customer_reward_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customer',
      key: 'customer_id'
    }
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'customer_reward',
  timestamps: false,
  indexes: [
    {
      fields: ['customer_id']
    },
    {
      fields: ['order_id']
    }
  ]
});

class RewardModel {
  /**
   * Get customer rewards with pagination and sorting
   * @param {number} customerId - Customer ID
   * @param {Object} options - Query options (page, limit, sort, order)
   * @returns {Promise<Object>} Rewards data with pagination info
   */
  static async getCustomerRewards(customerId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'date_added',
        order = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      
      // Valid sort fields
      const validSortFields = ['points', 'description', 'date_added', 'order_id'];
      const sortField = validSortFields.includes(sort) ? sort : 'date_added';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const { count, rows } = await CustomerReward.findAndCountAll({
        where: {
          customer_id: customerId
        },
        order: [[sortField, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
        raw: true
      });

      return {
        rewards: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error fetching customer rewards: ${error.message}`);
    }
  }

  /**
   * Get total reward points for a customer
   * @param {number} customerId - Customer ID
   * @returns {Promise<number>} Total reward points
   */
  static async getTotalRewardPoints(customerId) {
    try {
      const result = await CustomerReward.sum('points', {
        where: {
          customer_id: customerId
        }
      });

      return result || 0;
    } catch (error) {
      throw new Error(`Error fetching total reward points: ${error.message}`);
    }
  }

  /**
   * Get total number of reward entries for a customer
   * @param {number} customerId - Customer ID
   * @returns {Promise<number>} Total number of reward entries
   */
  static async getTotalRewardEntries(customerId) {
    try {
      const count = await CustomerReward.count({
        where: {
          customer_id: customerId
        }
      });

      return count;
    } catch (error) {
      throw new Error(`Error fetching total reward entries: ${error.message}`);
    }
  }

  /**
   * Add reward points for a customer
   * @param {number} customerId - Customer ID
   * @param {number} orderId - Order ID (optional)
   * @param {string} description - Reward description
   * @param {number} points - Points to add (can be negative for deductions)
   * @returns {Promise<Object>} Created reward entry
   */
  static async addRewardPoints(customerId, orderId = 0, description, points) {
    try {
      const reward = await CustomerReward.create({
        customer_id: customerId,
        order_id: orderId,
        description: description,
        points: points,
        date_added: new Date()
      });

      return reward.toJSON();
    } catch (error) {
      throw new Error(`Error adding reward points: ${error.message}`);
    }
  }

  /**
   * Get reward history for a specific order
   * @param {number} customerId - Customer ID
   * @param {number} orderId - Order ID
   * @returns {Promise<Array>} Reward entries for the order
   */
  static async getRewardsByOrder(customerId, orderId) {
    try {
      const rewards = await CustomerReward.findAll({
        where: {
          customer_id: customerId,
          order_id: orderId
        },
        order: [['date_added', 'DESC']],
        raw: true
      });

      return rewards;
    } catch (error) {
      throw new Error(`Error fetching rewards by order: ${error.message}`);
    }
  }
}

module.exports = {
  CustomerReward,
  RewardModel
};