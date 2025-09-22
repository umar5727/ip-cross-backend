const redis = require('redis');
require('dotenv').config();

// Log Redis configuration
console.log('Redis Configuration:');
console.log(`Host: ${process.env.REDIS_HOST || '127.0.0.1'}`);
console.log(`Port: ${process.env.REDIS_PORT || 6379}`);
console.log(`Password: ${process.env.REDIS_PASSWORD ? '******' : 'Not set'}`);

// Create Redis client with proper configuration for v3.1.2
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis server refused connection');
    }
    // Reconnect after 5 seconds
    return 5000;
  }
});

// Handle Redis connection events
redisClient.on('error', (err) => {
  console.log('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
  
  // Test Redis connection by setting and getting a test key
  redisClient.set('test_connection', 'connected', (err) => {
    if (err) {
      console.error('Redis test set failed:', err);
    } else {
      console.log('Redis test set successful');
      
      // Try to get the test key
      redisClient.get('test_connection', (getErr, reply) => {
        if (getErr) {
          console.error('Redis test get failed:', getErr);
        } else {
          console.log('Redis test get successful:', reply);
        }
      });
    }
  });
});

// Cache middleware with error handling
const cache = (duration) => {
  return (req, res, next) => {
    try {
      // Skip cache if Redis is not connected
      if (!redisClient.connected) {
        console.log('Redis not connected, skipping cache');
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
          res.originalSend = res.send;
          res.send = function(body) {
            if (res.statusCode === 200) {
              try {
                redisClient.setex(key, duration, body);
                console.log(`Cached: ${key} for ${duration} seconds`);
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

module.exports = { redisClient, cache };