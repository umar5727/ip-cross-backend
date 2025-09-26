const { redisClient } = require('../../config/redis');
const { Op } = require('sequelize');
const Product = require('../models/product/product.model');
const ProductDescription = require('../models/product/product_description.model');

/**
 * Service for background caching of popular product searches
 */
class CacheService {
  /**
   * Get the most popular search terms
   * @param {number} limit - Maximum number of terms to retrieve
   * @returns {Promise<Array>} Array of popular search terms
   */
  async getPopularSearchTerms(limit = 10) {
    return new Promise((resolve, reject) => {
      if (!redisClient || !redisClient.connected) {
        return resolve([]);
      }

      redisClient.zrevrange('popular_searches', 0, limit - 1, (err, results) => {
        if (err) {
          console.error('Error getting popular search terms:', err);
          return resolve([]);
        }
        resolve(results || []);
      });
    });
  }

  /**
   * Pre-cache search results for popular terms
   * @param {number} limit - Maximum number of terms to cache
   */
  async cachePopularSearches(limit = 10) {
    try {
      const popularTerms = await this.getPopularSearchTerms(limit);
      
      if (!popularTerms.length) {
        console.log('No popular search terms found for caching');
        return;
      }

      console.log(`Background caching ${popularTerms.length} popular search terms`);
      
      for (const term of popularTerms) {
        await this.cacheSearchResults(term);
      }
      
      console.log('Background caching completed');
    } catch (error) {
      console.error('Error in background caching:', error);
    }
  }

  /**
   * Cache search results for a specific term
   * @param {string} searchQuery - The search term to cache
   */
  async cacheSearchResults(searchQuery) {
    try {
      // Skip if no search query or Redis not connected
      if (!searchQuery || !redisClient || !redisClient.connected) {
        return;
      }

      // Generate the cache key as it would be in the middleware
      const key = `__express__/api/products?search=${encodeURIComponent(searchQuery)}&page=1&limit=10`;
      
      // Check if already cached
      const exists = await new Promise(resolve => {
        redisClient.exists(key, (err, reply) => {
          if (err) {
            console.error('Redis exists error:', err);
            resolve(false);
          }
          resolve(reply === 1);
        });
      });

      if (exists) {
        console.log(`Cache already exists for term: ${searchQuery}`);
        return;
      }

      // Perform the search query
      const queryOptions = {
        limit: 10,
        offset: 0,
        include: [
          {
            model: ProductDescription,
            as: 'product_descriptions',
            attributes: ['name', 'meta_title', 'meta_description', 'meta_keyword', 'tag'],
            where: {
              [Op.or]: [
                { name: { [Op.like]: `%${searchQuery}%` } },
                { meta_title: { [Op.like]: `%${searchQuery}%` } },
                { tag: { [Op.like]: `%${searchQuery}%` } },
                { meta_keyword: { [Op.like]: `%${searchQuery}%` } },
                { meta_description: { [Op.like]: `%${searchQuery}%` } }
              ]
            },
            required: true
          }
        ]
      };

      const products = await Product.findAndCountAll(queryOptions);
      
      // Format the response data
      const formattedProducts = products.rows.map(product => {
        const productJson = product.toJSON();
        return {
          ...productJson,
          name: product.product_description ? product.product_description.name : product.model,
          description: product.product_description ? product.product_description.description : ''
        };
      });

      const responseData = {
        success: true,
        count: products.count,
        data: formattedProducts,
        totalPages: Math.ceil(products.count / 10),
        currentPage: 1
      };

      // Cache the results for 1 hour
      await new Promise(resolve => {
        redisClient.setex(key, 3600, JSON.stringify(responseData), (err) => {
          if (err) {
            console.error(`Error caching search results for ${searchQuery}:`, err);
          } else {
            console.log(`Successfully cached search results for: ${searchQuery}`);
          }
          resolve();
        });
      });
    } catch (error) {
      console.error(`Error caching search for ${searchQuery}:`, error);
    }
  }
}

module.exports = CacheService;