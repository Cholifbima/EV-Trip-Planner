/**
 * Configuration settings for the EV Trip Planner
 */
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  environment: process.env.NODE_ENV || 'development'
}; 