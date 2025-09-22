const axios = require('axios');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
let authToken = null;
let productId = null;
let cartId = null;

// Test user credentials - hardcoded for testing
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'umerkhan5727@gmail.com',
  password: process.env.TEST_USER_PASSWORD || '1234'
};

// Helper function for API requests// Configure axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  // Add session middleware compatibility
  withCredentials: true
});

// Set auth token for subsequent requests
const setAuthHeader = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// Test customer login to get auth token
async function login() {
  try {
    console.log('🔑 Logging in to get auth token...');
    const response = await api.post('/api/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    authToken = response.data.token;
    setAuthHeader(authToken);
    console.log('✅ Login successful, token received');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

// Get a product to add to cart
async function getProduct() {
  try {
    console.log('🔍 Fetching a product to add to cart...');
    const response = await api.get('/api/products');
    
    if (response.data.data && response.data.data.length > 0) {
      productId = response.data.data[0].product_id;
      console.log(`✅ Found product with ID: ${productId}`);
      return true;
    } else {
      console.log('❌ No products found');
      return false;
    }
  } catch (error) {
    console.error('❌ Error fetching products:', error.response?.data || error.message);
    return false;
  }
}

// Test adding product to cart
async function addToCart() {
  try {
    console.log(`🛒 Adding product ${productId} to cart...`);
    
    // Use a consistent session ID for the entire test
    const testSessionId = 'test_session_fixed';
    
    const response = await api.post('/api/cart/add', {
      product_id: productId,
      quantity: 1
      // Don't pass session_id in body, let the auth token handle it
    });
    
    console.log('✅ Product added to cart:', response.data);
    
    // Get cart to find the cart_id - don't pass session_id when authenticated
    const cartResponse = await api.get('/api/cart');
    console.log('Cart response:', cartResponse.data);
    if (cartResponse.data.data && cartResponse.data.data.products && cartResponse.data.data.products.length > 0) {
      cartId = cartResponse.data.data.products[0].cart_id;
      console.log(`✅ Cart ID retrieved: ${cartId}`);
    } else {
      console.log('⚠️ No products found in cart response');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error adding to cart:', error.response?.data || error.message);
    return false;
  }
}

// Test updating cart item quantity
async function updateCart() {
  try {
    console.log(`🔄 Updating cart item ${cartId} quantity to 2...`);
    const response = await api.put('/api/cart/update', {
      cart_id: cartId,
      quantity: 2
    });
    
    console.log('✅ Cart updated:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error updating cart:', error.response?.data || error.message);
    return false;
  }
}

// Test removing item from cart
async function removeFromCart() {
  try {
    console.log(`🗑️ Removing item ${cartId} from cart...`);
    const response = await api.delete(`/api/cart/remove/${cartId}`);
    
    console.log('✅ Item removed from cart:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error removing from cart:', error.response?.data || error.message);
    return false;
  }
}

// Test clearing the entire cart
async function clearCart() {
  try {
    console.log('🧹 Clearing entire cart...');
    const response = await api.delete('/api/cart/clear');
    
    console.log('✅ Cart cleared:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error clearing cart:', error.response?.data || error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 STARTING CART TESTS 🧪');
  console.log('========================');
  
  // Login first
  if (!await login()) {
    console.log('❌ Tests aborted due to login failure');
    return;
  }
  
  // Get a product
  if (!await getProduct()) {
    console.log('❌ Tests aborted due to product fetch failure');
    return;
  }
  
  // Test cart operations
  await addToCart();
  
  if (cartId) {
    await updateCart();
    await removeFromCart();
  } else {
    console.log('⚠️ Skipping update and remove tests as no cart ID was retrieved');
  }
  
  await clearCart();
  
  console.log('========================');
  console.log('🎉 CART TESTS COMPLETED 🎉');
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error during tests:', error);
});