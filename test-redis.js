// Simple script to test Redis connection and data storage
require('dotenv').config();
const redis = require('redis');

console.log('Redis Configuration:');
console.log(`Host: ${process.env.REDIS_HOST || '127.0.0.1'}`);
console.log(`Port: ${process.env.REDIS_PORT || 6379}`);
console.log(`Password: ${process.env.REDIS_PASSWORD ? '******' : 'Not set'}`);

// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

// Handle connection errors
client.on('error', (err) => {
  console.log('Redis Error:', err);
});

// Test connection and operations
client.on('connect', () => {
  console.log('Connected to Redis');
  
  // Test 1: Set a key
  client.set('test_key', 'test_value', (err, reply) => {
    if (err) {
      console.error('Set Error:', err);
    } else {
      console.log('Set Result:', reply);
      
      // Test 2: Get the key we just set
      client.get('test_key', (err, reply) => {
        if (err) {
          console.error('Get Error:', err);
        } else {
          console.log('Get Result:', reply);
          
          // Test 3: Set a key with expiration (similar to token storage)
          client.set('auth_test', 'test_token', 'EX', 3600, (err, reply) => {
            if (err) {
              console.error('Auth Set Error:', err);
            } else {
              console.log('Auth Set Result:', reply);
              
              // Test 4: List all keys
              client.keys('*', (err, keys) => {
                if (err) {
                  console.error('Keys Error:', err);
                } else {
                  console.log('All Keys:', keys);
                  
                  // Clean up and exit
                  console.log('Tests completed, closing connection');
                  client.quit();
                }
              });
            }
          });
        }
      });
    }
  });
});