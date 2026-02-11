require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',

  // Session and Auth configuration
  auth: {
    sessionSecret: process.env.SESSION_SECRET || 'super-secret-key-for-dev',
    // In a real app, use a secure way to store and manage users, not hardcoded credentials.
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'password',
  },

  // MongoDB configuration (primary database)
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/wifi-sentry',
  },

  // Firebase configuration (optional - for future cloud integration)
  // Uncomment and configure these environment variables if you want to enable Firebase
  /*
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    tokenUri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    clientX509CertUrl: process.env.FIREBASE_CLIENT_URL,
  },
  */

  // Google Gemini API configuration
  gemini: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || 'your-gemini-api-key',
    model: process.env.GEMINI_MODEL || 'gemini-pro',
  },

  // Google Maps SDK configuration
  maps: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || 'your-maps-api-key',
  },

  // WiGLE.net configuration for wardriving database integration
  wigle: {
    apiName: process.env.WIGLE_API_NAME,
    apiToken: process.env.WIGLE_API_TOKEN,
    baseUrl: 'https://api.wigle.net/api/v2',
  },

  // Database collections used by Mongoose/MongoDB
  collections: {
    threats: 'threats',
    userSubmissions: 'user_submissions',
    wifiNetworks: 'wifi_networks',
    locations: 'locations',
  },
};