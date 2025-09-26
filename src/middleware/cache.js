const { redisClient } = require('../../config/redis');

/**
 * Cache middleware with error handling
 * @param {number} duration - Cache duration in seconds (default: 3600 seconds = 1 hour)
 * @returns {Function} Express middleware function
 */
const cache = (duration = 3600) => {
  return (req, res, next) => {
    try {
      // Skip cache if Redis is not connected
      if (!redisClient || !redisClient.connected) {
        return next();
      }

      const key = `__express__${req.originalUrl || req.url}`;
      
      redisClient.get(key, (err, cachedResponse) => {
        if (err) {
          console.error('Redis cache get error:', err);
          return next();
        }
        
        if (cachedResponse) {
          try {
            const data = JSON.parse(cachedResponse);
            return res.json(data);
          } catch (parseError) {
            console.error('Redis cache parse error:', parseError);
            return next();
          }
        } else {
          res.originalSend = res.json;
          res.json = function(body) {
            if (res.statusCode === 200) {
              try {
                redisClient.setex(key, duration, JSON.stringify(body));
                
                // Track this search query if it's a product search
                if (req.originalUrl.includes('/api/products') && req.query.search) {
                  trackSearchQuery(req.query.search);
                }
              } catch (error) {
                console.error('Redis cache set error:', error);
              }
            }
            res.originalSend(body);
          };
          next();
        }
      });
    } catch (error) {
      console.error('Redis middleware error:', error);
      next();
    }
  };
};

/**
 * Track popular search queries for background caching
 * @param {string} query - The search query to track
 */
function trackSearchQuery(query) {
  if (!query || !redisClient || !redisClient.connected) return;
  
  const key = 'popular_searches';
  const normalizedQuery = query.trim().toLowerCase();
  
  // Increment the score for this search term
  redisClient.zincrby(key, 1, normalizedQuery, (err) => {
    if (err) {
      console.error('Error tracking search query:', err);
    }
  });
}

// Export both the cache middleware function and the tracking function
module.exports = cache;
// Also export the object with both functions for services that need them
module.exports.trackSearchQuery = trackSearchQuery;