'use strict';

/**
 * Desktop Application Configuration — single source of truth.
 *
 * Adding a new service (database, map API, Wireshark, cloud backend, …):
 *   1. Add a feature flag in `features` and any relevant config block below.
 *   2. Create  desktop/handlers/<service>.js  that exports register(ipcMain, ctx).
 *   3. Add the handler path to HANDLER_MODULES in main.js.
 *   Nothing else needs to change.
 */

const path = require('path');
const os   = require('os');

const BACKEND_PORT = parseInt(process.env.BACKEND_PORT, 10) || 3000;

module.exports = {

  // ── Window ──────────────────────────────────────────────────────────────────
  window: {
    width:     1400,
    height:    900,
    minWidth:  800,
    minHeight: 600,
  },

  // ── Backend process ─────────────────────────────────────────────────────────
  backend: {
    port:           BACKEND_PORT,
    startupDelayMs: parseInt(process.env.BACKEND_STARTUP_DELAY_MS, 10) || 2000,
    devScript:      'dev',
    devUrl:         `http://localhost:${BACKEND_PORT}`,
    prodIndex:      path.join('web-app', 'out', 'index.html'),
  },

  // ── Auto-updater ─────────────────────────────────────────────────────────────
  updates: {
    enabled: process.env.DISABLE_AUTO_UPDATE !== 'true',
    channel: process.env.UPDATE_CHANNEL || 'latest',
  },

  // ── Auto-launch & startup behaviour ─────────────────────────────────────────
  autoLaunch: {
    /**
     * When true, registers WiFi Sentry in the OS login-items (Windows startup /
     * macOS Login Items) so it launches silently at boot.
     * Controlled at runtime via IPC handlers; this is the default.
     */
    enabled:             process.env.AUTO_LAUNCH === 'true',
    /**
     * Start the monitoring scan automatically as soon as the app is ready,
     * without requiring the user to click anything.
     */
    autoStartMonitoring: process.env.AUTO_START_MONITORING !== 'false',
    /**
     * Default technique set used when auto-starting.
     * Comma-separated: 'karma,evil-twin'
     */
    defaultTechniques:   (process.env.AUTO_START_TECHNIQUES || 'karma,evil-twin').split(','),
  },

  // ── OS Notifications ─────────────────────────────────────────────────────────
  notifications: {
    /** Show a native OS notification when a threat is detected. */
    enabled:    process.env.NOTIFICATIONS !== 'false',
    /** Minimum severity level to notify: 'Low' | 'Medium' | 'High' | 'Critical' */
    minSeverity: process.env.NOTIFY_MIN_SEVERITY || 'High',
  },

  // ── Feature flags ────────────────────────────────────────────────────────────
  features: {
    adapterManagement: process.env.FEATURE_ADAPTER_MANAGEMENT !== 'false',
    monitorMode:       process.env.FEATURE_MONITOR_MODE       !== 'false',
    wireshark:         process.env.FEATURE_WIRESHARK          === 'true',
    /**
     * Map API — always ON; defaults to Leaflet/OSM (no key required).
     * Set MAP_PROVIDER=google and MAP_API_KEY=<key> to upgrade to Google Maps.
     */
    mapApi:            process.env.FEATURE_MAP_API !== 'false',
    database:          process.env.FEATURE_DATABASE            === 'true',
    cloudBackend:      process.env.FEATURE_CLOUD_BACKEND       === 'true',
    aiAnalysis:        process.env.FEATURE_AI_ANALYSIS         !== 'false',
  },

  // ── Map API ──────────────────────────────────────────────────────────────────
  mapApi: {
    /**
     * 'leaflet-osm' = free OpenStreetMap tiles, no API key required (default).
     * 'google'      = Google Maps JavaScript API — set MAP_API_KEY.
     * 'mapbox'      = Mapbox — set MAP_API_KEY.
     */
    provider: process.env.MAP_PROVIDER || 'leaflet-osm',
    /** API key for Google Maps or Mapbox. Not needed for leaflet-osm. */
    apiKey:   process.env.MAP_API_KEY  || '',
    /** Leaflet/OSM tile URL template — override to use a self-hosted tile server. */
    tileUrl:  process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    /** Default map centre (lat/lng) if no location data is available. */
    defaultCenter: {
      lat: parseFloat(process.env.MAP_DEFAULT_LAT) || 37.7749,
      lng: parseFloat(process.env.MAP_DEFAULT_LNG) || -122.4194,
    },
    defaultZoom: parseInt(process.env.MAP_DEFAULT_ZOOM, 10) || 13,
  },

  // ── Database ─────────────────────────────────────────────────────────────────
  database: {
    /**
     * 'auto'    = try MongoDB first; fall back to SQLite automatically.
     * 'mongodb' = require MongoDB (fail if unavailable).
     * 'sqlite'  = always use embedded SQLite (zero-install).
     */
    type:       process.env.DB_TYPE || 'auto',
    uri:        process.env.MONGODB_URI || process.env.DB_URI || '',
    sqlitePath: process.env.SQLITE_PATH ||
                path.join(os.homedir(), '.wifi-sentry', 'data.db'),
  },

  // ── Wireshark / tshark ───────────────────────────────────────────────────────
  wireshark: {
    tsharkPath:    process.env.TSHARK_PATH    || null,
    dumpcapPath:   process.env.DUMPCAP_PATH   || null,
    captureDir:    process.env.CAPTURE_DIR    || os.tmpdir(),
    defaultFilter: process.env.CAPTURE_FILTER || '',
  },

  // ── Cloud backend ────────────────────────────────────────────────────────────
  cloudBackend: {
    baseUrl:   process.env.CLOUD_BACKEND_URL || '',
    apiKey:    process.env.CLOUD_API_KEY     || '',
    timeoutMs: parseInt(process.env.CLOUD_TIMEOUT_MS, 10) || 10000,
  },

  // ── AI analysis ──────────────────────────────────────────────────────────────
  ai: {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    model:  process.env.GEMINI_MODEL   || 'gemini-2.0-flash',
  },

  // ── Capture backends (monitor mode) ──────────────────────────────────────────
  capture: {
    /**
     * 'auto'    = probe in order: npcap → wsl2 → airpcap → vendor
     * 'npcap'   = Npcap + WlanHelper.exe  (Windows 8+, recommended)
     * 'wsl2'    = WSL2 + airmon-ng / iw   (Windows 10 2004+)
     * 'airpcap' = AirPcap USB hardware
     * 'vendor'  = 3rd-party driver (RTL8812AU, AR9271, MT7610U, …)
     */
    backend:    process.env.CAPTURE_BACKEND || 'auto',
    wsl2Method: process.env.WSL2_METHOD     || 'aircrack',
  },

};
