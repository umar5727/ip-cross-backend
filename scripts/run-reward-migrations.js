require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runRewardMigrations() {
  // Get database configuration from environment variables
  const dbConfig = {
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'ipshopy-cross-platform',
    multipleStatements: true
  };

  let connection;
  try {
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database successfully');

    // Check if customer_reward table already exists
    const [existingTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_reward'
    `, [dbConfig.database]);

    if (existingTables.length > 0) {
      console.log('customer_reward table already exists, skipping creation...');
    } else {
      // Read and execute the migration file
      const migrationPath = path.join(__dirname, '../migrations/create_reward_tables.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log('Creating reward tables...');
      await connection.query(migrationSQL);
      console.log('Reward tables created successfully');
    }

    // Verify table was created
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_reward'
    `, [dbConfig.database]);

    if (tables.length > 0) {
      console.log('Verified reward table exists: customer_reward');
      
      // Check if table has data
      const [rows] = await connection.query('SELECT COUNT(*) as count FROM customer_reward');
      console.log(`Table contains ${rows[0].count} reward entries`);
    } else {
      console.log('Warning: customer_reward table not found after migration');
    }

  } catch (error) {
    console.error('Error running reward migrations:', error);
    console.error('SQL Error Details:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

runRewardMigrations();