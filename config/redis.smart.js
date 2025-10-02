// Smart Redis configuration that automatically detects Redis availability
// and falls back to in-memory cache if Redis is not available

const redis = require('redis');
require('dotenv').config();

let redisClient;
let isRedisAvailable = false;
let fallbackClient;

// Create fallback client
class FallbackRedisClient {
  constructor() {
    this.cache = new Map();
    this.connected = false;
    console.log('📝 Using Redis fallback (in-memory cache)');
  }

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

  setex(key, seconds, value, callback) {
    try {
      this.cache.set(key, value);
      setTimeout(() => this.cache.delete(key), seconds * 1000);
      if (callback) callback(null, 'OK');
      return Promise.resolve('OK');
    } catch (error) {
      if (callback) callback(error);
      return Promise.reject(error);
    }
  }

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

  end(callback) {
    return this.quit(callback);
  }

  on(event, handler) {
    if (event === 'connect') {
      setTimeout(() => handler(), 10);
    }
    return this;
  }
}

// Try to create Redis client
try {
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    connect_timeout: 3000,
    retry_strategy: function(options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        console.log('❌ Redis not available, using fallback');
        return new Error('Redis not available');
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });

  // Test Redis connection
  redisClient.on('connect', () => {
    isRedisAvailable = true;
    console.log('✅ Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    console.log('❌ Redis connection failed:', err.message);
    console.log('🔄 Switching to fallback mode');
    isRedisAvailable = false;
  });

  // Set timeout to detect if Redis is not responding
  setTimeout(() => {
    if (!isRedisAvailable) {
      console.log('⏰ Redis connection timeout, using fallback');
      isRedisAvailable = false;
    }
  }, 5000);

} catch (error) {
  console.log('❌ Redis initialization failed:', error.message);
  isRedisAvailable = false;
}

// Create fallback client
fallbackClient = new FallbackRedisClient();

// Smart client that automatically chooses between Redis and fallback
const smartRedisClient = {
  set: (key, value, callback) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.set(key, value, callback);
    } else {
      return fallbackClient.set(key, value, callback);
    }
  },

  get: (key, callback) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.get(key, callback);
    } else {
      return fallbackClient.get(key, value, callback);
    }
  },

  del: (key, callback) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.del(key, callback);
    } else {
      return fallbackClient.del(key, callback);
    }
  },

  setex: (key, seconds, value, callback) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.setex(key, seconds, value, callback);
    } else {
      return fallbackClient.setex(key, seconds, value, callback);
    }
  },

  quit: (callback) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.quit(callback);
    } else {
      return fallbackClient.quit(callback);
    }
  },

  end: (callback) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.end(callback);
    } else {
      return fallbackClient.end(callback);
    }
  },

  on: (event, handler) => {
    if (isRedisAvailable && redisClient.connected) {
      return redisClient.on(event, handler);
    } else {
      return fallbackClient.on(event, handler);
    }
  },

  get connected() {
    return isRedisAvailable ? redisClient.connected : fallbackClient.connected;
  },

  get isRedisAvailable() {
    return isRedisAvailable;
  }
};

// Cache middleware
const cache = (duration) => {
  return (req, res, next) => {
    const key = `__express__${req.originalUrl || req.url}`;
    
    smartRedisClient.get(key, (err, cachedResponse) => {
      if (err || !cachedResponse) {
        res.originalSend = res.send;
        res.send = function(body) {
          if (res.statusCode === 200) {
            try {
              smartRedisClient.setex(key, duration, body);
            } catch (error) {
              // Ignore cache errors
            }
          }
          res.originalSend(body);
        };
        return next();
      }
      
      try {
        const data = JSON.parse(cachedResponse);
        return res.json(data);
      } catch (parseError) {
        return next();
      }
    });
  };
};

module.exports = { redisClient: smartRedisClient, cache };
