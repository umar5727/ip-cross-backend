require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function updateTicketTables() {
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

    // Drop old ticket tables if they exist
    console.log('Dropping old ticket tables...');
    await connection.query('DROP TABLE IF EXISTS `ticket_replies`');
    await connection.query('DROP TABLE IF EXISTS `tickets`');
    console.log('Old ticket tables dropped');

    // Read and execute the migration file
    const migrationPath = path.join(__dirname, '../migrations/create_ticket_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Creating new ticket tables with OpenCart structure...');
    await connection.query(migrationSQL);
    console.log('New ticket tables created successfully');

    // Verify tables were created
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%customer_ticket%'
    `, [dbConfig.database]);

    if (tables.length > 0) {
      console.log('Verified ticket tables:');
      tables.forEach(row => console.log(`- ${row.TABLE_NAME}`));
    } else {
      console.log('Warning: No ticket tables found after migration');
    }

  } catch (error) {
    console.error('Error updating ticket tables:', error);
    console.error('SQL Error Details:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

updateTicketTables();