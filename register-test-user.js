const axios = require('axios');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test user data
const TEST_USER = {
  firstname: 'Test',
  lastname: 'User',
  email: 'test@example.com',
  telephone: '1234567890',
  password: 'password123'
};

// Helper function for API requests
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Register a new test user
async function registerTestUser() {
  try {
    console.log('🔑 Registering test user...');
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    
    const response = await api.post('/api/auth/register', TEST_USER);
    
    console.log('✅ Registration successful!');
    console.log('User data:', response.data.data);
    console.log('Token:', response.data.token);
    
    return true;
  } catch (error) {
    if (error.response && error.response.status === 400 && error.response.data.message === 'Email already in use') {
      console.log('ℹ️ Test user already exists. You can use these credentials to login:');
      console.log(`Email: ${TEST_USER.email}`);
      console.log(`Password: ${TEST_USER.password}`);
      return true;
    }
    
    console.error('❌ Registration failed:', error.response?.data || error.message);
    return false;
  }
}

// Run the registration
registerTestUser().catch(error => {
  console.error('Unhandled error during registration:', error);
});