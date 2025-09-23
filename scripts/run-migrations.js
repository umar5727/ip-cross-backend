require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runMigrations() {
  // Get database configuration from environment variables
  const dbConfig = {
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'ipshopy-cross-platform', // Use the correct database name
    multipleStatements: true // Enable multiple SQL statements
  };

  let connection;
  try {
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database successfully');

    // Check for existing ticket tables
    const [rows] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('tickets', 'ticket_replies')
    `, [dbConfig.database]);

    if (rows.length > 0) {
      console.log('Existing tables found:');
      rows.forEach(row => console.log(`- ${row.TABLE_NAME}`));
    } else {
      console.log('No ticket tables found in database');
    }
    
    console.log('Migration script updated - Razorpay functionality removed');
    console.log('Database connection test completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    console.error('SQL Error Details:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

runMigrations();