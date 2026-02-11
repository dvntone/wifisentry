/**
 * Capacitor Configuration for WiFi Sentry Mobile App
 * Enables deployment to iOS and Android
 */

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wifisentry.app',
  appName: 'WiFi Sentry',
  webDir: 'web-app/.next/standalone/public',
  bundledWebRuntime: false,
  backgroundColor: '#000000',
  
  // Server configuration
  server: {
    // Comment out for production, use for development
    // url: 'http://192.168.1.100:8100', // Your dev server
    iosScheme: 'capacitor',
    androidScheme: 'https',
  },

  // Plugin configurations
  plugins: {
    // Geolocation plugin for GPS tracking
    Geolocation: {
      // Use high accuracy for better location data
      highAccuracy: true,
      timeout: 30000, // 30 seconds
      enableHighAccuracy: true,
    },

    // Network monitoring
    Network: {
      // No special config needed
    },

    // App life cycle and events
    App: {
      // App will continue running in background
    },

    // Local notifications for threats
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav',
    },

    // Storage for offline data
    Storage: {
      group: 'group.com.wifisentry.app',
    },
  },

  // iOS specific configuration
  ios: {
    contentInset: 'automatic',
    preferredStatusBarStyle: 'lightContent',
  },

  // Android specific configuration
  android: {
    // Buildtools version (update as needed)
    buildToolsVersion: '34.0.0',
    
    // Minimum SDK version (Android 8 - API 26)
    minSdkVersion: 26,
    
    // Target SDK version
    targetSdkVersion: 34,
    
    // Support legacy HTTP traffic (for localhost development)
    usesCleartextTraffic: true,
  },
};

export default config;
