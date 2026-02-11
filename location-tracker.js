/**
 * Location Tracking module - handles geolocation and mapping of WiFi networks
 */

const database = require('./database');
const axios = require('axios');
const config = require('./config');

/**
 * Get user's current location (requires browser geolocation API or GPS)
 * Note: This function is meant for browser environment, server-side would need different approach
 */
async function getCurrentLocation() {
  try {
    // This would be called from the frontend
    // For now, return a mock location
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 15,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
}

/**
 * Log a WiFi network location
 */
async function logNetworkLocation(networkData, locationData, userConsent = false) {
  try {
    if (!userConsent) {
      console.warn('User has not consented to location tracking');
      return null;
    }

    const locationRecord = {
      bssid: networkData.bssid,
      ssid: networkData.ssid,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      accuracy: locationData.accuracy,
      altitude: locationData.altitude,
      heading: locationData.heading,
      speed: locationData.speed,
      userConsented: true,
      canBeSharedWithWigle: userConsent,
    };

    return await database.locations.log(locationRecord);
  } catch (error) {
    console.error('Error logging network location:', error);
    throw error;
  }
}

/**
 * Get all logged locations
 */
async function getAllLocations(userConsent = false) {
  try {
    if (!userConsent) {
      return [];
    }
    return await database.locations.getAll();
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
}

/**
 * Format location data for WiGLE.net export
 */
function formatForWigle(networks) {
  // WiGLE.net expects CSV format with specific columns
  const headers = ['BSSID', 'SSID', 'AuthMode', 'FirstSeen', 'Channel', 'RSSI', 'CurrentLatitude', 'CurrentLongitude', 'AltitudeMeters', 'AccuracyMeters', 'Type'];

  const rows = networks.map(network => [
    network.bssid,
    `"${(network.ssid || '').replace(/"/g, '""')}"`, // Escape quotes in SSID
    network.security || 'UNKNOWN',
    network.detectedAt || network.timestamp || new Date().toISOString(),
    network.frequency || '',
    network.signal || '',
    network.latitude || '',
    network.longitude || '',
    network.altitude || '',
    network.accuracy || '',
    'WiFi',
  ]);

  return {
    headers,
    rows,
    csv: [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n'),
  };
}

/**
 * Export to WiGLE.net
 */
async function exportToWigle(networks) {
  try {
    if (!config.wigle.apiName || !config.wigle.apiToken) {
      throw new Error('WiGLE.net credentials not configured');
    }

    const formattedData = formatForWigle(networks);

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', new Blob([formattedData.csv], { type: 'text/csv' }), 'networks.csv');

    // Note: This is a conceptual implementation
    // Actual WiGLE.net API implementation would require proper authentication
    const response = await axios.post(
      `${config.wigle.baseUrl}/file/upload`,
      formData,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.wigle.apiName}:${config.wigle.apiToken}`).toString('base64')}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      }
    );

    return {
      success: true,
      message: 'Successfully exported to WiGLE.net',
      response: response.data,
    };
  } catch (error) {
    console.error('Error exporting to WiGLE.net:', error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get nearby networks
 */
async function getNearbyNetworks(latitude, longitude, radiusKm = 1) {
  try {
    const allLocations = await database.locations.getAll();

    return allLocations.filter(location => {
      const distance = calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      );
      return distance <= radiusKm;
    }).map(location => ({
      ...location,
      distance: calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      ),
    })).sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error finding nearby networks:', error);
    throw error;
  }
}

/**
 * Create geofencing alert
 */
async function createGeofence(location, radiusMeters, ssidFilter = null) {
  try {
    const geofence = {
      id: Date.now().toString(),
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters,
      ssidFilter,
      createdAt: new Date().toISOString(),
      enabled: true,
    };

    return geofence;
  } catch (error) {
    console.error('Error creating geofence:', error);
    throw error;
  }
}

module.exports = {
  getCurrentLocation,
  logNetworkLocation,
  getAllLocations,
  formatForWigle,
  exportToWigle,
  calculateDistance,
  getNearbyNetworks,
  createGeofence,
};
