'use strict';

/**
 * WiFi Adapter Management API Endpoints — Fastify plugin
 * Handles external WiFi adapter configuration and monitoring.
 * Supports both Windows (Electron) and Android (Capacitor) platforms.
 */

const { v4: uuidv4 } = require('uuid');

module.exports = async function adapterRoutes(fastify) {
  // ── GET /api/adapters ───────────────────────────────────────────────────

  fastify.get('/api/adapters', async (request, reply) => {
    try {
      const platform = request.query.platform || 'windows';
      if (platform === 'windows') {
        const adapters = await getWindowsAdapters();
        return reply.send({ platform: 'windows', adapters, supportsExternal: true });
      }
      if (platform === 'android') {
        const adapters = await getAndroidUSBAdapters();
        return reply.send({ platform: 'android', adapters, supportsUSBOTG: true, supportsRoot: true });
      }
      return reply.status(400).send({ error: 'Invalid platform' });
    } catch (err) {
      fastify.log.error({ err }, 'Error getting adapters');
      return reply.status(500).send({ error: 'Failed to retrieve adapters' });
    }
  });

  // ── GET /api/adapters/device-info ───────────────────────────────────────

  fastify.get('/api/adapters/device-info', async (request, reply) => {
    try {
      const platform = request.query.platform || (process.platform === 'win32' ? 'windows' : 'android');
      if (platform === 'windows') {
        return reply.send({ platform: 'windows', supportsExternalAdapters: true, supportsMonitorMode: true, osVersion: process.platform });
      }
      const isRooted = await checkAndroidRootAccess();
      return reply.send({ platform: 'android', supportsUSBOTG: true, supportsMonitorMode: isRooted, supportsPromiscuousMode: isRooted, isRooted, supportsExternalAdapters: true });
    } catch (err) {
      fastify.log.error({ err }, 'Error getting device info');
      return reply.status(500).send({ error: 'Failed to retrieve device info' });
    }
  });

  // ── GET /api/adapters/settings ──────────────────────────────────────────

  fastify.get('/api/adapters/settings', async (request, reply) => {
    const userId = request.session?.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
    const platform = request.query.platform || 'windows';
    return reply.send({
      userId,
      platform,
      selectedAdapter: null,
      settings: { useExternalAdapter: false, autoDetectAdapters: true, monitoringMode: 'default', rootAccessEnabled: false, adapterRefreshInterval: 5000 },
    });
  });

  // ── PUT /api/adapters/settings ──────────────────────────────────────────

  fastify.put('/api/adapters/settings', async (request, reply) => {
    const userId = request.session?.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
    const { platform, settings } = request.body;
    if (platform === 'android' && settings?.rootAccessEnabled) {
      const hasRoot = await checkAndroidRootAccess();
      if (!hasRoot) return reply.status(403).send({ error: 'Root access not available on this device' });
    }
    return reply.send({ success: true, message: 'Settings updated', settings: { userId, platform, ...settings, lastUpdated: new Date() } });
  });

  // ── POST /api/adapters/select ───────────────────────────────────────────

  fastify.post('/api/adapters/select', async (request, reply) => {
    const userId = request.session?.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
    const { adapterId, adapterName, platform } = request.body;
    if (!adapterId || !platform) return reply.status(400).send({ error: 'Missing required fields' });
    const adapterSettings = { settingsId: uuidv4(), userId, platform, selectedAdapter: { id: adapterId, name: adapterName, timestamp: new Date() } };
    return reply.send({ success: true, message: `Selected adapter: ${adapterName}`, settings: adapterSettings });
  });

  // ── GET /api/adapters/:id ───────────────────────────────────────────────

  fastify.get('/api/adapters/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const platform = request.query.platform || 'windows';
      const adapter = platform === 'windows' ? await getWindowsAdapterDetails(id) : await getAndroidAdapterDetails(id);
      if (!adapter) return reply.status(404).send({ error: 'Adapter not found' });
      return reply.send(adapter);
    } catch (err) {
      fastify.log.error({ err }, 'Error getting adapter details');
      return reply.status(500).send({ error: 'Failed to retrieve adapter details' });
    }
  });

  // ── GET /api/adapters/stats/:id ─────────────────────────────────────────

  fastify.get('/api/adapters/stats/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const platform = request.query.platform || 'windows';
      const stats = platform === 'windows' ? await getWindowsAdapterStats(id) : await getAndroidAdapterStats(id);
      if (!stats) return reply.status(404).send({ error: 'Could not retrieve adapter stats' });
      return reply.send(stats);
    } catch (err) {
      fastify.log.error({ err }, 'Error getting adapter stats');
      return reply.status(500).send({ error: 'Failed to retrieve adapter stats' });
    }
  });

  // ── POST /api/adapters/enable-monitor-mode ──────────────────────────────

  fastify.post('/api/adapters/enable-monitor-mode', async (request, reply) => {
    const userId = request.session?.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
    const hasRoot = await checkAndroidRootAccess();
    if (!hasRoot) return reply.status(403).send({ error: 'Root access required for monitor mode', helpText: 'Your device must be rooted to enable monitor mode' });
    return reply.send({ success: true, message: 'Monitor mode enabled', mode: 'monitor', requiresRoot: true });
  });

  // ── POST /api/adapters/enable-promiscuous-mode ──────────────────────────

  fastify.post('/api/adapters/enable-promiscuous-mode', async (request, reply) => {
    const userId = request.session?.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
    const hasRoot = await checkAndroidRootAccess();
    if (!hasRoot) return reply.status(403).send({ error: 'Root access required for promiscuous mode', helpText: 'Your device must be rooted to enable promiscuous mode' });
    return reply.send({ success: true, message: 'Promiscuous mode enabled', mode: 'promiscuous', requiresRoot: true });
  });
};

// ── Helpers (placeholder implementations) ───────────────────────────────────

async function getWindowsAdapters() {
  return [{ id: 'adapter-builtin-1', name: 'Intel Wireless Adapter', type: 'built-in', status: 'connected', vendor: 'Intel', model: 'AX200', supportedModes: ['standard'] }];
}
async function getWindowsAdapterDetails(id) {
  return { id, name: 'Intel Wireless Adapter', type: 'built-in', status: 'connected', signalStrength: 85, channel: 6, frequency: 2437 };
}
async function getWindowsAdapterStats(id) {
  return { id, bytesReceived: 1024000, bytesSent: 512000, packetsReceived: 5000, packetsSent: 2500 };
}
async function getAndroidUSBAdapters() {
  return [];
}
async function getAndroidAdapterDetails(id) {
  return { id, name: 'USB WiFi Adapter', type: 'external', vendor: 'Realtek', model: 'RTL8811AU', supportedModes: ['default', 'monitor', 'promiscuous'], requiresRoot: false };
}
async function getAndroidAdapterStats(id) {
  return { id, signalStrength: 70, packetsSniffed: 10000, threatsDetected: 3 };
}
async function checkAndroidRootAccess() {
  return false;
}
