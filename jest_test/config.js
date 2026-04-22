/**
 * SamaySafar Test Configuration
 * Centralized settings for all Jest integration tests
 */

const config = {
  // Try to use environment variable or fallback to Render URL
  // To test against local server, set EXPO_PUBLIC_API_BASE_URL="http://localhost:8000"
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || "https://prerna-rai-samaysafar.onrender.com",
  
  // Test Credentials
  credentials: {
    email: process.env.TEST_EMAIL || "bayungraiprerna@gmail.com",
    password: process.env.TEST_PASSWORD || "Expo5544#@", // This should match the password in the database
  },
  
  // Timeout for API requests (in milliseconds)
  timeout: 30000,
};

module.exports = config;
