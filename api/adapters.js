/**
 * WiFi Adapter Management API Endpoints
 * Handles external WiFi adapter configuration and monitoring
 * Supports both Windows (Electron) and Android (Capacitor) platforms
 */

const express = require('express');
const router = express.Router();
const database = require('../database');
const { v4: uuidv4 } = require('uuid');

// Adapter settings schema
const adapterSettingsSchema = {
  userId: String,
  platform: String, // 'windows' or 'android'
  selectedAdapter: {
    id: String,
    name: String,
    type: String, // 'built-in' or 'external'
    vendor: String,
  },
  settings: {
    useExternalAdapter: Boolean,
    autoDetectAdapters: Boolean,
    monitoringMode: String, // 'default', 'monitor', 'promiscuous' (Android only)
    rootAccessEnabled: Boolean,
    adapterRefreshInterval: Number, // milliseconds
  },
  lastUpdated: Date,
  deviceInfo: {
    isRooted: Boolean,
    supportsUSBOTG: Boolean,
    totalAdapters: Number,
  },
};

/**
 * GET /api/adapters - Get available WiFi adapters
 */
router.get('/adapters', async (req, res) => {
  try {
    const platform = req.query.platform || 'windows'; // 'windows' or 'android'

    if (platform === 'windows') {
      // For Windows: Return detected adapters
      const adapters = await getWindowsAdapters();
      res.json({
        platform: 'windows',
        adapters,
        supportsExternal: true,
      });
    } else if (platform === 'android') {
      // For Android: Return USB OTG devices
      const adapters = await getAndroidUSBAdapters();
      res.json({
        platform: 'android',
        adapters,
        supportsUSBOTG: true,
        supportsRoot: true,
      });
    } else {
      res.status(400).json({ error: 'Invalid platform' });
    }
  } catch (error) {
    console.error('Error getting adapters:', error);
    res.status(500).json({ error: 'Failed to retrieve adapters' });
  }
});

/**
 * GET /api/adapters/:id - Get specific adapter details
 */
router.get('/adapters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const platform = req.query.platform || 'windows';

    let adapter;

    if (platform === 'windows') {
      adapter = await getWindowsAdapterDetails(id);
    } else if (platform === 'android') {
      adapter = await getAndroidAdapterDetails(id);
    }

    if (!adapter) {
      return res.status(404).json({ error: 'Adapter not found' });
    }

    res.json(adapter);
  } catch (error) {
    console.error('Error getting adapter details:', error);
    res.status(500).json({ error: 'Failed to retrieve adapter details' });
  }
});

/**
 * POST /api/adapters/select - Select active adapter
 */
router.post('/adapters/select', async (req, res) => {
  try {
    const { adapterId, adapterName, platform } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!adapterId || !platform) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Save to database
    const settingsId = uuidv4();
    const adapterSettings = {
      settingsId,
      userId,
      platform,
      selectedAdapter: {
        id: adapterId,
        name: adapterName,
        timestamp: new Date(),
      },
    };

    // TODO: Save to database using database module
    // await database.adapterSettings.save(adapterSettings);

    res.json({
      success: true,
      message: `Selected adapter: ${adapterName}`,
      settings: adapterSettings,
    });
  } catch (error) {
    console.error('Error selecting adapter:', error);
    res.status(500).json({ error: 'Failed to select adapter' });
  }
});

/**
 * GET /api/adapters/settings - Get current adapter settings
 */
router.get('/adapters/settings', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const platform = req.query.platform || 'windows';

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // TODO: Retrieve from database
    // const settings = await database.adapterSettings.get(userId, platform);

    const defaultSettings = {
      userId,
      platform,
      selectedAdapter: null,
      settings: {
        useExternalAdapter: false,
        autoDetectAdapters: true,
        monitoringMode: 'default',
        rootAccessEnabled: false,
        adapterRefreshInterval: 5000,
      },
    };

    res.json(defaultSettings);
  } catch (error) {
    console.error('Error getting adapter settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

/**
 * PUT /api/adapters/settings - Update adapter settings
 */
router.put('/adapters/settings', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { platform, settings } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate settings based on platform
    if (platform === 'android' && settings.rootAccessEnabled) {
      // Verify root access is actually available
      const hasRoot = await checkAndroidRootAccess();
      if (!hasRoot) {
        return res.status(403).json({
          error: 'Root access not available on this device',
        });
      }
    }

    // TODO: Save to database
    // await database.adapterSettings.update(userId, platform, settings);

    res.json({
      success: true,
      message: 'Settings updated',
      settings: {
        userId,
        platform,
        ...settings,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error('Error updating adapter settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * POST /api/adapters/enable-monitor-mode - Enable monitor mode (Android only)
 */
router.post('/adapters/enable-monitor-mode', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { adapterId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify root access
    const hasRoot = await checkAndroidRootAccess();
    if (!hasRoot) {
      return res.status(403).json({
        error: 'Root access required for monitor mode',
        helpText: 'Your device must be rooted to enable monitor mode',
      });
    }

    // TODO: Enable monitor mode via native Android code

    res.json({
      success: true,
      message: 'Monitor mode enabled',
      mode: 'monitor',
      requiresRoot: true,
    });
  } catch (error) {
    console.error('Error enabling monitor mode:', error);
    res.status(500).json({ error: 'Failed to enable monitor mode' });
  }
});

/**
 * POST /api/adapters/enable-promiscuous-mode - Enable promiscuous mode (Android only)
 */
router.post('/adapters/enable-promiscuous-mode', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { adapterId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify root access
    const hasRoot = await checkAndroidRootAccess();
    if (!hasRoot) {
      return res.status(403).json({
        error: 'Root access required for promiscuous mode',
        helpText: 'Your device must be rooted to enable promiscuous mode',
      });
    }

    // TODO: Enable promiscuous mode via native Android code

    res.json({
      success: true,
      message: 'Promiscuous mode enabled',
      mode: 'promiscuous',
      requiresRoot: true,
    });
  } catch (error) {
    console.error('Error enabling promiscuous mode:', error);
    res.status(500).json({ error: 'Failed to enable promiscuous mode' });
  }
});

/**
 * GET /api/adapters/device-info - Get device adapter capabilities
 */
router.get('/adapters/device-info', async (req, res) => {
  try {
    const platform = req.query.platform || process.platform === 'win32' ? 'windows' : 'android';

    let deviceInfo;

    if (platform === 'windows') {
      deviceInfo = {
        platform: 'windows',
        supportsExternalAdapters: true,
        supportsMonitorMode: true,
        osVersion: process.platform,
      };
    } else if (platform === 'android') {
      const isRooted = await checkAndroidRootAccess();

      deviceInfo = {
        platform: 'android',
        supportsUSBOTG: true,
        supportsMonitorMode: isRooted,
        supportsPromiscuousMode: isRooted,
        isRooted,
        supportsExternalAdapters: true,
      };
    }

    res.json(deviceInfo);
  } catch (error) {
    console.error('Error getting device info:', error);
    res.status(500).json({ error: 'Failed to retrieve device info' });
  }
});

/**
 * GET /api/adapters/stats/:id - Get adapter statistics
 */
router.get('/adapters/stats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const platform = req.query.platform || 'windows';

    let stats;

    if (platform === 'windows') {
      stats = await getWindowsAdapterStats(id);
    } else if (platform === 'android') {
      stats = await getAndroidAdapterStats(id);
    }

    if (!stats) {
      return res.status(404).json({ error: 'Could not retrieve adapter stats' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting adapter stats:', error);
    res.status(500).json({ error: 'Failed to retrieve adapter stats' });
  }
});

// ============ Helper Functions ============

/**
 * Get Windows adapters (placeholder)
 */
async function getWindowsAdapters() {
  // This would be called from Windows Adapter Manager
  return [
    {
      id: 'adapter-builtin-1',
      name: 'Intel Wireless Adapter',
      type: 'built-in',
      status: 'connected',
      vendor: 'Intel',
      model: 'AX200',
      supportedModes: ['standard'],
    },
  ];
}

/**
 * Get Windows adapter details (placeholder)
 */
async function getWindowsAdapterDetails(id) {
  return {
    id,
    name: 'Intel Wireless Adapter',
    type: 'built-in',
    status: 'connected',
    signalStrength: 85,
    channel: 6,
    frequency: 2437,
  };
}

/**
 * Get Windows adapter stats (placeholder)
 */
async function getWindowsAdapterStats(id) {
  return {
    id,
    bytesReceived: 1024000,
    bytesSent: 512000,
    packetsReceived: 5000,
    packetsSent: 2500,
  };
}

/**
 * Get Android USB adapters (placeholder)
 */
async function getAndroidUSBAdapters() {
  // This would scan actual USB devices
  return [];
}

/**
 * Get Android adapter details (placeholder)
 */
async function getAndroidAdapterDetails(id) {
  return {
    id,
    name: 'USB WiFi Adapter',
    type: 'external',
    vendor: 'Realtek',
    model: 'RTL8811AU',
    supportedModes: ['default', 'monitor', 'promiscuous'],
    requiresRoot: false,
  };
}

/**
 * Get Android adapter stats (placeholder)
 */
async function getAndroidAdapterStats(id) {
  return {
    id,
    signalStrength: 70,
    packetsSniffed: 10000,
    threats detected: 3,
  };
}

/**
 * Check Android root access (placeholder)
 */
async function checkAndroidRootAccess() {
  // In real implementation, this would check for root
  return false;
}

module.exports = router;
