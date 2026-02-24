'use strict';

/**
 * Map API IPC handler module.
 *
 * Manages the map provider configuration (Leaflet/OSM by default; upgrades to
 * Google Maps when an API key is set).  Persists the user's choice in
 * settings.json so it survives restarts.
 *
 * IPC channels exposed:
 *   get-map-config      → { provider, apiKey, tileUrl, defaultCenter, defaultZoom }
 *   set-map-config      → { success }  — merges partial config, persists to settings.json
 *   validate-map-key    → { valid, error? } — checks Google Maps key reachability
 *
 * Adding a new provider:
 *   1. Add a TILE_TEMPLATES entry below.
 *   2. The renderer's NetworkMap component will pick it up automatically.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

/** Tile URL templates for each supported provider. */
const TILE_TEMPLATES = {
  'leaflet-osm': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'google':      'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  'google-sat':  'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  'mapbox':      'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token={apiKey}',
};

/**
 * Register map IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 * @param {{ config: object, app: Electron.App, log: Function }} ctx
 */
function register(ipcMain, ctx) {
  const { config, log } = ctx;
  const app = ctx.app;

  const settingsPath = path.join(
    app.getPath('appData'), 'WiFi Sentry', 'settings.json'
  );

  /** Load persisted settings.json, or return {} if it doesn't exist. */
  function loadSettings() {
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch { /* ignore */ }
    return {};
  }

  /** Persist a partial settings update. */
  function saveSettings(partial) {
    try {
      const current = loadSettings();
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({ ...current, ...partial }, null, 2));
    } catch (err) {
      log(`[map] Error saving settings: ${err.message}`);
    }
  }

  /** Return the current effective map config (saved settings override defaults). */
  function getEffectiveConfig() {
    const saved = loadSettings().mapApi || {};
    const base  = config.mapApi || {};
    return {
      provider:      saved.provider      ?? base.provider      ?? 'leaflet-osm',
      apiKey:        saved.apiKey        ?? base.apiKey        ?? '',
      tileUrl:       saved.tileUrl       ?? base.tileUrl       ?? TILE_TEMPLATES['leaflet-osm'],
      defaultCenter: saved.defaultCenter ?? base.defaultCenter ?? { lat: 37.7749, lng: -122.4194 },
      defaultZoom:   saved.defaultZoom   ?? base.defaultZoom   ?? 13,
      tileTemplates: TILE_TEMPLATES,
    };
  }

  // ── get-map-config ──────────────────────────────────────────────────────────
  ipcMain.handle('get-map-config', () => {
    const cfg = getEffectiveConfig();
    log(`[map] get-map-config → provider=${cfg.provider}`);
    return cfg;
  });

  // ── set-map-config ──────────────────────────────────────────────────────────
  ipcMain.handle('set-map-config', (_event, updates) => {
    try {
      const current = getEffectiveConfig();
      const next = { ...current, ...updates };

      // Auto-select the canonical tile URL for the chosen provider if the user
      // hasn't overridden it manually.
      if (updates.provider && !updates.tileUrl && TILE_TEMPLATES[next.provider]) {
        next.tileUrl = TILE_TEMPLATES[next.provider];
      }

      saveSettings({ mapApi: next });
      log(`[map] set-map-config → provider=${next.provider}`);
      return { success: true, config: next };
    } catch (err) {
      log(`[map] set-map-config error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  // ── validate-map-key ────────────────────────────────────────────────────────
  // Quick reachability check: hit the Geocoding API with the provided key and
  // see if the response is an error vs. valid JSON.  Does not consume quota
  // beyond a single zero-result geocode.
  ipcMain.handle('validate-map-key', (_event, { apiKey }) => {
    return new Promise((resolve) => {
      if (!apiKey) {
        return resolve({ valid: false, error: 'No API key provided' });
      }
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${encodeURIComponent(apiKey)}`;
      const req = https.get(url, (res) => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            const VALID_STATUSES = new Set(['OK', 'ZERO_RESULTS']);
            if (VALID_STATUSES.has(json.status)) {
              resolve({ valid: true });
            } else {
              resolve({ valid: false, error: json.error_message || `Google API status: ${json.status}` });
            }
          } catch {
            resolve({ valid: false, error: 'Unexpected response from Google' });
          }
        });
      });
      req.on('error', (err) => resolve({ valid: false, error: err.message }));
      req.setTimeout(8000, () => { req.destroy(); resolve({ valid: false, error: 'Request timed out' }); });
    });
  });

  log('[map] Map API IPC handlers registered');
}

module.exports = { register };
