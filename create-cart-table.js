const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');
require('dotenv').config();

async function createCartTable() {
  try {
    console.log('Creating cart table...');
    
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Define the cart table structure
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS oc_cart (
        cart_id INT AUTO_INCREMENT PRIMARY KEY,
        api_id INT DEFAULT 0,
        customer_id INT DEFAULT 0,
        session_id VARCHAR(32) NOT NULL,
        product_id INT NOT NULL,
        recurring_id INT DEFAULT 0,
        option TEXT,
        quantity INT NOT NULL DEFAULT 1,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX cart_customer_session_idx (customer_id, session_id),
        INDEX cart_product_idx (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    console.log('Cart table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating cart table:', error);
    process.exit(1);
  }
}

createCartTable();