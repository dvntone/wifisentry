require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',

  // Session and Auth configuration
  // Do NOT hardcode secrets; prefer env vars. In production missing critical
  // secrets will cause startup to fail (see bottom of this file).
  auth: {
    sessionSecret: process.env.SESSION_SECRET || (() => {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SESSION_SECRET environment variable is required in production');
        }
        return 'dev-only-secret-key';
    })(),
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || (() => {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ADMIN_PASSWORD environment variable is required in production');
        }
        return 'dev-password';
    })(),
    adminTwoFactorSecret: process.env.ADMIN_2FA_SECRET || null,
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
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || null,
    model: process.env.GEMINI_MODEL || 'gemini-pro',
  },

  // Google Maps SDK configuration
  maps: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
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

// Enforce secure configuration in production: fail fast if critical secrets are missing.
if ((process.env.NODE_ENV || 'development') === 'production') {
  const missing = [];
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (!process.env.MONGO_URI) missing.push('MONGO_URI');
  if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    /* eslint-disable no-console */
    console.error('Missing required environment variables in production:', missing.join(', '));
    throw new Error('Missing required environment variables: ' + missing.join(', '));
  }
}