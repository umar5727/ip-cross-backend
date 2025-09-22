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

    // Read the SQL migration file
    const sqlFilePath = path.join(__dirname, '..', 'migrations', 'create_mobile_razorpay_tables.sql');
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');

    // Execute the SQL statements
    console.log('Executing migration SQL...');
    await connection.query(sqlContent);
    console.log('Migration completed successfully');

    // Verify tables were created
    const [rows] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'mobile_razorpay_%'
    `, [dbConfig.database]);

    if (rows.length > 0) {
      console.log('Razorpay tables created:');
      rows.forEach(row => console.log(`- ${row.TABLE_NAME}`));
    } else {
      console.log('Warning: No Razorpay tables were found after migration');
      
      // Additional debugging - show all tables in the database
      const [allTables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
        LIMIT 10
      `, [dbConfig.database]);
      
      console.log('First 10 tables in database:');
      allTables.forEach(row => console.log(`- ${row.TABLE_NAME}`));
    }
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