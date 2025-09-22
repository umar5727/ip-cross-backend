const { redisClient } = require('../../config/redis');

/**
 * Cache middleware with error handling
 * @param {number} duration - Cache duration in seconds
 * @returns {Function} Express middleware function
 */
const cache = (duration) => {
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

module.exports = cache;