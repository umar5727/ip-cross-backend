// Fallback Redis configuration for cPanel when Redis is not available
// This provides the same interface as Redis but stores data in memory

class FallbackRedisClient {
  constructor() {
    this.cache = new Map();
    this.connected = false;
    console.log('📝 Using Redis fallback (in-memory cache)');
  }

  // Simulate Redis set operation
  set(key, value, callback) {
    try {
      this.cache.set(key, value);
      if (callback) callback(null, 'OK');
      return Promise.resolve('OK');
    } catch (error) {
      if (callback) callback(error);
      return Promise.reject(error);
    }
  }

  // Simulate Redis get operation
  get(key, callback) {
    try {
      const value = this.cache.get(key) || null;
      if (callback) callback(null, value);
      return Promise.resolve(value);
    } catch (error) {
      if (callback) callback(error);
      return Promise.reject(error);
    }
  }

  // Simulate Redis delete operation
  del(key, callback) {
    try {
      const deleted = this.cache.delete(key);
      if (callback) callback(null, deleted ? 1 : 0);
      return Promise.resolve(deleted ? 1 : 0);
    } catch (error) {
      if (callback) callback(error);
      return Promise.reject(error);
    }
  }

  // Simulate Redis setex operation (set with expiration)
  setex(key, seconds, value, callback) {
    try {
      this.cache.set(key, value);
      
      // Set expiration (simplified - in real Redis this would be handled by the server)
      setTimeout(() => {
        this.cache.delete(key);
      }, seconds * 1000);
      
      if (callback) callback(null, 'OK');
      return Promise.resolve('OK');
    } catch (error) {
      if (callback) callback(error);
      return Promise.reject(error);
    }
  }

  // Simulate Redis quit operation
  quit(callback) {
    try {
      this.cache.clear();
      if (callback) callback();
      return Promise.resolve();
    } catch (error) {
      if (callback) callback(error);
      return Promise.reject(error);
    }
  }

  // Simulate Redis end operation
  end(callback) {
    return this.quit(callback);
  }

  // Event handlers (no-op for fallback)
  on(event, handler) {
    // Simulate immediate connection for fallback
    if (event === 'connect') {
      setTimeout(() => handler(), 10);
    }
    return this;
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create fallback client instance
const redisClient = new FallbackRedisClient();

// Cache middleware with fallback support
const cache = (duration) => {
  return (req, res, next) => {
    const key = `__express__${req.originalUrl || req.url}`;
    
    redisClient.get(key, (err, cachedResponse) => {
      if (err || !cachedResponse) {
        // Cache miss or error, continue without cache
        res.originalSend = res.send;
        res.send = function(body) {
          if (res.statusCode === 200) {
            try {
              redisClient.setex(key, duration, body);
            } catch (error) {
              // Ignore cache errors in fallback mode
            }
          }
          res.originalSend(body);
        };
        return next();
      }
      
      // Return cached response
      try {
        const data = JSON.parse(cachedResponse);
        return res.json(data);
      } catch (parseError) {
        return next();
      }
    });
  };
};

module.exports = { redisClient, cache };
