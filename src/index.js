require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8000;

// Import database connection
const db = require('./config/database');

// Import Redis client
const { redisClient } = require('./config/redis');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const customerRoutes = require('./src/routes/customer.routes');
const productRoutes = require('./src/routes/product.routes');
const categoryRoutes = require('./src/routes/category.routes');
const orderRoutes = require('./src/routes/order.routes');
const authRoutes = require('./src/routes/auth.routes');
const cartRoutes = require('./src/routes/cart.routes');
const checkoutRoutes = require('./src/routes/checkout.routes');
const ticketRoutes = require('./src/routes/ticket.routes');
const adminRoutes = require('./src/routes/admin.routes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to E-commerce API' });
});

// Debug endpoints
app.get('/debug/db', async (req, res) => {
  try {
    const { Customer } = require('./src/models');
    const count = await Customer.count();
    res.json({ 
      success: true, 
      message: 'Database connected', 
      totalCustomers: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database debug error:', error);
    res.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/debug/env', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not Set',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    PORT: process.env.PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/debug/test-login', async (req, res) => {
  try {
    const { Customer } = require('./src/models');
    const testEmail = 'john.do@example.in';
    
    console.log('Testing login for email:', testEmail);
    
    const customer = await Customer.findOne({ where: { email: testEmail } });
    
    res.json({
      success: true,
      email: testEmail,
      customerFound: !!customer,
      customerId: customer ? customer.customer_id : null,
      customerStatus: customer ? customer.status : null,
      hasPassword: customer ? !!customer.password : false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test login error:', error);
    res.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enable detailed logging
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create error log file
const errorLogStream = fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' });
const appLogStream = fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' });

// Override console.error to write to file
const originalError = console.error;
console.error = (...args) => {
  originalError(...args);
  errorLogStream.write(new Date().toISOString() + ' - ' + args.join(' ') + '\n');
};

// Override console.log to write to file
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  appLogStream.write(new Date().toISOString() + ' - ' + args.join(' ') + '\n');
};


// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Test database connection
  try {
    await db.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
  
  // Test Redis connection
  try {
    // Redis v3.1.2 automatically connects, no need to call connect()
    if (redisClient.connected) {
      console.log('Redis connection has been established successfully.');
    } else {
      redisClient.on('connect', () => {
        console.log('Redis connection has been established successfully.');
      });
    }
  } catch (error) {
    console.error('Unable to connect to Redis:', error);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});