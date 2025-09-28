require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

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
const customerAccountRoutes = require('./src/routes/customer_account.routes');
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
app.use('/api/customer-account', customerAccountRoutes);
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