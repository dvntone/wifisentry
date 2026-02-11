const mongoose = require('mongoose');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function verify() {
  console.log('\n🔍 WiFi Sentry Service Verification\n');
  let criticalError = false;

  // --- 1. MongoDB (Critical) ---
  console.log('Checking Database (MongoDB)...');
  if (!process.env.MONGO_URI) {
    console.log('❌ Missing MONGO_URI in .env');
    criticalError = true;
  } else {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to MongoDB');
      await mongoose.disconnect();
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      criticalError = true;
    }
  }

  // --- 2. Google Gemini (Critical) ---
  console.log('\nChecking AI Service (Google Gemini)...');
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.log('❌ Missing GOOGLE_GEMINI_API_KEY in .env');
    criticalError = true;
  } else {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('ping');
      console.log('✅ API Key is valid');
    } catch (error) {
      console.log(`❌ API check failed: ${error.message}`);
      criticalError = true;
    }
  }

  // --- 3. Google Maps (Optional) ---
  console.log('\nChecking Maps (Google Maps)...');
  if (process.env.GOOGLE_MAPS_API_KEY) {
    console.log('✅ API Key present');
  } else {
    console.log('⚠️  Missing GOOGLE_MAPS_API_KEY (Location mapping disabled)');
  }

  // --- 4. WiGLE (Optional) ---
  console.log('\nChecking Export Service (WiGLE.net)...');
  if (process.env.WIGLE_API_NAME && process.env.WIGLE_API_TOKEN) {
    console.log('✅ Credentials present');
  } else {
    console.log('⚠️  Missing WiGLE credentials (Export disabled)');
  }

  console.log('\n---------------------------------------------------');
  if (criticalError) {
    console.log('❌ CRITICAL: Essential services are missing or invalid.');
    console.log('   Please update your .env file with the required keys.');
    process.exit(1);
  } else {
    console.log('✅ System Ready: All essential services are linked.');
    process.exit(0);
  }
}

verify();