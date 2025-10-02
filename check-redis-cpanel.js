require('dotenv').config();
const redis = require('redis');

function checkRedisOnCPanel() {
  console.log('🔍 Checking Redis availability on cPanel...');
  console.log('='.repeat(50));
  
  // Display current configuration
  console.log('📋 Current Redis Configuration:');
  console.log(`Host: ${process.env.REDIS_HOST || '127.0.0.1'}`);
  console.log(`Port: ${process.env.REDIS_PORT || 6379}`);
  console.log(`Password: ${process.env.REDIS_PASSWORD ? '******' : 'Not set'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');

  const client = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    connect_timeout: 5000, // 5 second timeout
    retry_strategy: function(options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        console.log('❌ Redis connection refused - Redis server not available');
        return new Error('Redis server not available');
      }
      if (options.total_retry_time > 5000) {
        console.log('❌ Redis connection timeout - Redis server not responding');
        return new Error('Redis connection timeout');
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });

  let connectionTested = false;

  // Handle successful connection
  client.on('connect', () => {
    if (connectionTested) return;
    connectionTested = true;
    
    console.log('✅ Redis is AVAILABLE and working!');
    console.log('🎉 You can use Redis for caching on cPanel');
    console.log('');
    
    // Test basic operations
    client.set('cpanel_test', 'success', (err) => {
      if (err) {
        console.log('⚠️  Redis connection successful but operations failed:', err.message);
        return;
      }
      
      client.get('cpanel_test', (err, result) => {
        if (err) {
          console.log('⚠️  Redis get operation failed:', err.message);
          return;
        }
        
        console.log('✅ Redis operations test successful:', result);
        console.log('📝 Recommendation: Use Redis for production caching');
        
        // Clean up test key
        client.del('cpanel_test', () => {
          client.quit();
        });
      });
    });
  });

  // Handle connection errors
  client.on('error', (err) => {
    if (connectionTested) return;
    connectionTested = true;
    
    console.log('❌ Redis is NOT AVAILABLE on cPanel');
    console.log('🔍 Error details:', err.message);
    console.log('');
    
    if (err.code === 'ECONNREFUSED') {
      console.log('💡 This means:');
      console.log('   - Redis server is not running');
      console.log('   - Redis is not installed on your cPanel hosting');
      console.log('   - Redis is blocked by firewall');
      console.log('   - Wrong host/port configuration');
    } else if (err.code === 'ETIMEDOUT') {
      console.log('💡 This means:');
      console.log('   - Redis server is not responding');
      console.log('   - Network connectivity issues');
      console.log('   - Wrong host configuration');
    }
    
    console.log('');
    console.log('🛠️  Solutions:');
    console.log('   1. Contact your hosting provider about Redis availability');
    console.log('   2. Use the fallback configuration (no Redis)');
    console.log('   3. Use alternative caching solutions');
    console.log('   4. Upgrade to a VPS/dedicated server with Redis');
    
    client.quit();
  });

  // Handle connection end
  client.on('end', () => {
    console.log('');
    console.log('🔚 Redis connection test completed');
  });

  // Set a timeout to prevent hanging
  setTimeout(() => {
    if (!connectionTested) {
      connectionTested = true;
      console.log('⏰ Redis connection test timed out');
      console.log('❌ Redis is likely not available on this cPanel hosting');
      console.log('');
      console.log('🛠️  Recommendation: Use fallback configuration without Redis');
      client.quit();
    }
  }, 10000); // 10 second timeout
}

// Run the check
checkRedisOnCPanel();
