/**
 * Desktop Application Configuration
 *
 * Single source of truth for all tunable values, feature flags, and
 * extension-point stubs for the Electron main process.
 *
 * Adding a new service (database, map API, Wireshark, cloud backend, etc.)
 * means:
 *   1. Add a feature flag here and any relevant connection config.
 *   2. Create  desktop/handlers/<service>.js  that exports register(ipcMain, ctx).
 *   3. Add the handler file path to the HANDLER_MODULES list in main.js.
 *
 * No other file needs to change.
 */

'use strict';

const path = require('path');
const os   = require('os');

// Resolve the backend port once so it is not duplicated across keys.
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
    /** Port the Express/Node backend listens on (mutable at runtime by port-manager). */
    port: BACKEND_PORT,
    /** Milliseconds to wait after spawning the backend before opening the window. */
    startupDelayMs: parseInt(process.env.BACKEND_STARTUP_DELAY_MS, 10) || 2000,
    /** npm script used in dev mode. */
    devScript: 'dev',
    /** URL loaded in the renderer in dev mode (kept in sync when port changes). */
    devUrl: `http://localhost:${BACKEND_PORT}`,
    /**
     * Relative path (from repo root) to the static Next.js export index.
     * next.config.ts uses output:"export" which writes to web-app/out/.
     */
    prodIndex: path.join('web-app', 'out', 'index.html'),
  },

  // ── Auto-updater ────────────────────────────────────────────────────────────
  updates: {
    /** Set to false to disable auto-update checks entirely. */
    enabled: process.env.DISABLE_AUTO_UPDATE !== 'true',
    /** Release channel: 'latest' | 'beta' | 'alpha' */
    channel: process.env.UPDATE_CHANNEL || 'latest',
  },

  // ── Feature flags ───────────────────────────────────────────────────────────
  features: {
    /** WiFi adapter selection and per-adapter scanning. */
    adapterManagement:  process.env.FEATURE_ADAPTER_MANAGEMENT  !== 'false',

    /**
     * 802.11 monitor mode — sets the adapter to raw frame capture mode.
     * Backends: Npcap+WlanHelper (Windows 8+), WSL2+airmon-ng (Win 10 2004+),
     * AirPcap hardware, or vendor-specific drivers (RTL8812AU, AR9271, etc.).
     */
    monitorMode:        process.env.FEATURE_MONITOR_MODE        !== 'false',

    /**
     * Wireshark / tshark integration — deep packet capture and PCAP analysis.
     * Requires Npcap + Wireshark installed.  Set to true once the
     * desktop/handlers/wireshark.js handler module is implemented.
     */
    wireshark:          process.env.FEATURE_WIRESHARK           === 'true',

    /**
     * Map API — plot detected networks and threats on an interactive map.
     * Configure mapApi.provider / mapApi.apiKey below.
     */
    mapApi:             process.env.FEATURE_MAP_API             === 'true',

    /**
     * Local / remote database — persist scans, threats, and history beyond
     * the in-memory store.  Configure database.* below.
     */
    database:           process.env.FEATURE_DATABASE            === 'true',

    /**
     * Cloud / remote backend — connect to a hosted WiFi Sentry server instead
     * of (or in addition to) the local Node.js backend.
     */
    cloudBackend:       process.env.FEATURE_CLOUD_BACKEND       === 'true',

    /** AI-powered threat analysis via Gemini. */
    aiAnalysis:         process.env.FEATURE_AI_ANALYSIS         !== 'false',
  },

  // ── Wireshark / tshark ──────────────────────────────────────────────────────
  wireshark: {
    /** Absolute path to tshark.exe; null = auto-detect. */
    tsharkPath:    process.env.TSHARK_PATH    || null,
    /** Absolute path to dumpcap.exe; null = auto-detect. */
    dumpcapPath:   process.env.DUMPCAP_PATH   || null,
    /** Directory where PCAP capture files are written. */
    captureDir:    process.env.CAPTURE_DIR    || os.tmpdir(),
    /** Default BPF filter applied to all captures (empty = no filter). */
    defaultFilter: process.env.CAPTURE_FILTER || '',
  },

  // ── Map API ─────────────────────────────────────────────────────────────────
  mapApi: {
    /** 'google' | 'mapbox' | 'leaflet-osm' */
    provider: process.env.MAP_PROVIDER || 'leaflet-osm',
    /** API key for Google Maps or Mapbox (not needed for OSM/Leaflet). */
    apiKey:   process.env.MAP_API_KEY  || '',
    /** Tile server URL template for Leaflet/OSM. */
    tileUrl:  process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },

  // ── Database ─────────────────────────────────────────────────────────────────
  database: {
    /** 'mongodb' | 'sqlite' | 'firebase' */
    type: process.env.DB_TYPE || 'mongodb',
    /** Connection URI — used by MongoDB and similar drivers. */
    uri:  process.env.MONGODB_URI || process.env.DB_URI || '',
    /** Path to local SQLite file (only used when type = 'sqlite'). */
    sqlitePath: process.env.SQLITE_PATH || path.join(os.homedir(), '.wifi-sentry', 'data.db'),
  },

  // ── Cloud backend ────────────────────────────────────────────────────────────
  cloudBackend: {
    /** Base URL of the remote WiFi Sentry API. */
    baseUrl:   process.env.CLOUD_BACKEND_URL || '',
    /** Bearer token / API key for the remote API. */
    apiKey:    process.env.CLOUD_API_KEY     || '',
    /** Timeout (ms) for remote requests. */
    timeoutMs: parseInt(process.env.CLOUD_TIMEOUT_MS, 10) || 10000,
  },

  // ── AI analysis ──────────────────────────────────────────────────────────────
  ai: {
    /** Gemini API key. */
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    /** Gemini model to use for analysis. */
    model:  process.env.GEMINI_MODEL   || 'gemini-2.0-flash',
  },

  // ── Capture backends (monitor mode) ─────────────────────────────────────────
  capture: {
    /**
     * Preferred capture backend for 802.11 monitor mode.
     * 'auto'    = try in order: npcap → wsl2 → airpcap → vendor
     * 'npcap'   = Npcap + WlanHelper.exe  (Windows 8+, recommended)
     * 'wsl2'    = WSL2 + airmon-ng / iw   (Windows 10 2004+ only)
     * 'airpcap' = AirPcap USB hardware
     * 'vendor'  = Vendor-specific adapter driver
     */
    backend:    process.env.CAPTURE_BACKEND || 'auto',
    /** Default WSL2 sub-method when the wsl2 backend is active. */
    wsl2Method: process.env.WSL2_METHOD     || 'aircrack',
  },

};


  // ── Auto-updater ────────────────────────────────────────────────────────────
  updates: {
    /** Set to false to disable auto-update checks entirely. */
    enabled: process.env.DISABLE_AUTO_UPDATE !== 'true',
    /** Release channel: 'latest' | 'beta' | 'alpha' */
    channel: process.env.UPDATE_CHANNEL || 'latest',
  },

  // ── Feature flags ───────────────────────────────────────────────────────────
  // Each flag guards an entire feature subsystem.  Set via environment variable
  // or override here for development builds.
  features: {
    /** WiFi adapter selection and per-adapter scanning. */
    adapterManagement:  process.env.FEATURE_ADAPTER_MANAGEMENT  !== 'false',

    /**
     * 802.11 monitor mode — sets the adapter to raw frame capture mode.
     * Backends: Npcap+WlanHelper (Windows 8+), WSL2+airmon-ng (Win 10 2004+),
     * AirPcap hardware, or vendor-specific drivers (RTL8812AU, AR9271, etc.).
     */
    monitorMode:        process.env.FEATURE_MONITOR_MODE        !== 'false',

    /**
     * Wireshark / tshark integration — deep packet capture and PCAP analysis.
     * Requires Npcap + Wireshark installed.  Set to true once the
     * desktop/handlers/wireshark.js handler module is implemented.
     */
    wireshark:          process.env.FEATURE_WIRESHARK           === 'true',

    /**
     * Map API — plot detected networks and threats on an interactive map.
     * Configure mapApi.provider / mapApi.apiKey below.
     */
    mapApi:             process.env.FEATURE_MAP_API             === 'true',

    /**
     * Local / remote database — persist scans, threats, and history beyond
     * the in-memory store.  Configure database.* below.
     */
    database:           process.env.FEATURE_DATABASE            === 'true',

    /**
     * Cloud / remote backend — connect to a hosted WiFi Sentry server instead
     * of (or in addition to) the local Node.js backend.
     */
    cloudBackend:       process.env.FEATURE_CLOUD_BACKEND       === 'true',

    /** AI-powered threat analysis via Gemini. */
    aiAnalysis:         process.env.FEATURE_AI_ANALYSIS         !== 'false',
  },

  // ── Wireshark / tshark ──────────────────────────────────────────────────────
  // Populated automatically by WindowsNpcapManager; override here if needed.
  wireshark: {
    /** Absolute path to tshark.exe; null = auto-detect. */
    tsharkPath:   process.env.TSHARK_PATH   || null,
    /** Absolute path to dumpcap.exe; null = auto-detect. */
    dumpcapPath:  process.env.DUMPCAP_PATH  || null,
    /** Directory where PCAP capture files are written. */
    captureDir:   process.env.CAPTURE_DIR   || require('os').tmpdir(),
    /** Default BPF filter applied to all captures (empty = no filter). */
    defaultFilter: process.env.CAPTURE_FILTER || '',
  },

  // ── Map API ─────────────────────────────────────────────────────────────────
  mapApi: {
    /** 'google' | 'mapbox' | 'leaflet-osm' */
    provider: process.env.MAP_PROVIDER || 'leaflet-osm',
    /** API key for Google Maps or Mapbox (not needed for OSM/Leaflet). */
    apiKey:   process.env.MAP_API_KEY  || '',
    /** Tile server URL template for Leaflet/OSM. */
    tileUrl:  process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },

  // ── Database ─────────────────────────────────────────────────────────────────
  database: {
    /** 'mongodb' | 'sqlite' | 'firebase' */
    type: process.env.DB_TYPE || 'mongodb',
    /** Connection URI — used by MongoDB and similar drivers. */
    uri:  process.env.MONGODB_URI || process.env.DB_URI || '',
    /** Path to local SQLite file (only used when type = 'sqlite'). */
    sqlitePath: process.env.SQLITE_PATH || path.join(
      require('os').homedir(), '.wifi-sentry', 'data.db'
    ),
  },

  // ── Cloud backend ────────────────────────────────────────────────────────────
  cloudBackend: {
    /** Base URL of the remote WiFi Sentry API. */
    baseUrl:   process.env.CLOUD_BACKEND_URL || '',
    /** Bearer token / API key for the remote API. */
    apiKey:    process.env.CLOUD_API_KEY     || '',
    /** Timeout (ms) for remote requests. */
    timeoutMs: parseInt(process.env.CLOUD_TIMEOUT_MS, 10) || 10000,
  },

  // ── AI analysis ──────────────────────────────────────────────────────────────
  ai: {
    /** Gemini API key. */
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    /** Gemini model to use for analysis. */
    model:  process.env.GEMINI_MODEL   || 'gemini-2.0-flash',
  },

  // ── Capture backends (monitor mode) ─────────────────────────────────────────
  capture: {
    /**
     * Preferred capture backend for 802.11 monitor mode.
     * 'auto'    = try in order: npcap → wsl2 → airpcap → vendor
     * 'npcap'   = Npcap + WlanHelper.exe  (Windows 8+, recommended)
     * 'wsl2'    = WSL2 + airmon-ng / iw   (Windows 10 2004+ only)
     * 'airpcap' = AirPcap USB hardware
     * 'vendor'  = Vendor-specific adapter driver
     */
    backend: process.env.CAPTURE_BACKEND || 'auto',
    /** Default WSL2 sub-method when the wsl2 backend is active. */
    wsl2Method: process.env.WSL2_METHOD || 'aircrack',
  },

};
