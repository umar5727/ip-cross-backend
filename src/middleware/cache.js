const { redisClient } = require('../../config/redis');

/**
 * Cache metrics for monitoring performance
 */
const cacheMetrics = {
  hits: 0,
  misses: 0,
  totalResponseTime: 0,
  requestCount: 0
};

/**
 * Get dynamic TTL based on content type and route
 * @param {Object} req - Express request object
 * @param {number} defaultDuration - Default duration in seconds
 * @returns {number} TTL in seconds
 */
const getDynamicTTL = (req, defaultDuration) => {
  // Frequently changing data gets shorter TTL
  if (req.originalUrl.includes('/api/products') && req.query.sort === 'newest') {
    return 600; // 10 minutes for newest products
  }
  
  // Category listings can be cached longer
  if (req.originalUrl.includes('/api/categories')) {
    return 7200; // 2 hours for categories
  }
  
  // Search results with popular terms get longer cache
  if (req.originalUrl.includes('/api/products') && req.query.search) {
    return 3600; // 1 hour for search results
  }
  
  // Default duration for other routes
  return defaultDuration;
};

/**
 * Generate normalized cache key with sorted parameters
 * @param {Object} req - Express request object
 * @returns {string} Normalized cache key
 */
const getNormalizedCacheKey = (req) => {
  const baseUrl = req.originalUrl.split('?')[0] || req.url.split('?')[0];
  
  // If no query parameters, return the base URL
  if (!req.query || Object.keys(req.query).length === 0) {
    return `__express__${baseUrl}`;
  }
  
  // Sort query parameters alphabetically for consistent keys
  const sortedParams = Object.keys(req.query).sort().map(key => {
    return `${key}=${encodeURIComponent(req.query[key])}`;
  }).join('&');
  
  return `__express__${baseUrl}?${sortedParams}`;
};

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

      const startTime = Date.now();
      const key = getNormalizedCacheKey(req);
      
      redisClient.get(key, (err, cachedResponse) => {
        if (err) {
          console.error('Redis cache get error:', err);
          cacheMetrics.misses++;
          return next();
        }
        
        if (cachedResponse) {
          try {
            const data = JSON.parse(cachedResponse);
            // Track cache hit metrics
            cacheMetrics.hits++;
            cacheMetrics.totalResponseTime += (Date.now() - startTime);
            cacheMetrics.requestCount++;
            return res.json(data);
          } catch (parseError) {
            console.error('Redis cache parse error:', parseError);
            cacheMetrics.misses++;
            return next();
          }
        } else {
          // Track cache miss metrics
          cacheMetrics.misses++;
          
          res.originalSend = res.json;
          res.json = function(body) {
            // Track response time for uncached requests before sending
            const responseTime = Date.now() - startTime;
            
            // Send response to client immediately and don't wait for any cache operations
            res.originalSend(body);
            
            // All cache operations happen completely asynchronously after response is sent
            if (res.statusCode === 200) {
              // Use setTimeout with 0ms delay to ensure this runs in a separate event loop tick
              setTimeout(() => {
                try {
                  // Update metrics
                  cacheMetrics.totalResponseTime += responseTime;
                  cacheMetrics.requestCount++;
                  
                  // Use dynamic TTL based on content type
                  const ttl = getDynamicTTL(req, duration);
                  
                  // Store in cache with callback to ensure logging happens after caching
                  redisClient.setex(key, ttl, JSON.stringify(body), (err) => {
                    if (err) {
                      console.error('Redis cache set error:', err);
                    } else {
                      console.log(`Response sent first, then cached: ${key} for ${ttl} seconds`);
                    }
                  });
                  
                  // Track this search query if it's a product search
                  if (req.originalUrl.includes('/api/products') && req.query.search) {
                    trackSearchQuery(req.query.search);
                  }
                } catch (error) {
                  console.error('Redis cache set error:', error);
                }
              }, 0);
            }
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

/**
 * Get cache metrics for monitoring
 * @returns {Object} Cache performance metrics
 */
const getCacheMetrics = () => {
  const hitRate = cacheMetrics.requestCount > 0 
    ? (cacheMetrics.hits / cacheMetrics.requestCount * 100).toFixed(2) 
    : 0;
  
  const avgResponseTime = cacheMetrics.requestCount > 0 
    ? (cacheMetrics.totalResponseTime / cacheMetrics.requestCount).toFixed(2) 
    : 0;
  
  return {
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    hitRate: `${hitRate}%`,
    totalRequests: cacheMetrics.requestCount,
    avgResponseTime: `${avgResponseTime}ms`
  };
};

// Export both the cache middleware function and the tracking function
module.exports = cache;
// Also export the object with both functions for services that need them
module.exports.trackSearchQuery = trackSearchQuery;
module.exports.getCacheMetrics = getCacheMetrics;