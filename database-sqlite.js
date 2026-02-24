'use strict';

/**
 * Embedded SQLite adapter — zero-install local-first storage.
 *
 * Used automatically when MongoDB is unavailable (DB_TYPE=auto) or when
 * DB_TYPE=sqlite is set explicitly.  All data lives in a single file at
 * `~/.wifi-sentry/data.db` (configurable via SQLITE_PATH / desktop.config.js).
 *
 * Schema mirrors the Mongoose models in database.js so callers never need to
 * know which adapter is active.
 */

const BetterSQLite = require('better-sqlite3');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

// ── Connection ────────────────────────────────────────────────────────────────

let _db = null;

/**
 * Open (or create) the SQLite database.  Idempotent — safe to call multiple times.
 * @param {string} [dbPath] Override the default path.
 */
function connect(dbPath) {
  if (_db) return;

  const filePath = dbPath ||
    process.env.SQLITE_PATH ||
    path.join(os.homedir(), '.wifi-sentry', 'data.db');

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  _db = new BetterSQLite(filePath);
  _db.pragma('journal_mode = WAL');   // safe concurrent reads
  _db.pragma('foreign_keys = ON');
  _createSchema();
  console.log(`[SQLite] Connected to ${filePath}`);
}

function _db_() {
  if (!_db) connect();
  return _db;
}

// ── Schema ────────────────────────────────────────────────────────────────────

function _createSchema() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS threats (
      id          TEXT PRIMARY KEY,
      name        TEXT,
      description TEXT,
      severity    TEXT,
      explanation TEXT,
      detection_methods TEXT,
      mitigation  TEXT,
      indicators  TEXT,
      source      TEXT,
      discovered_date TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id             TEXT PRIMARY KEY,
      name           TEXT,
      description    TEXT,
      status         TEXT DEFAULT 'pending',
      research_result TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS networks (
      id              TEXT PRIMARY KEY,
      ssid            TEXT,
      bssid           TEXT,
      security        TEXT,
      signal          INTEGER,
      frequency       INTEGER,
      channel         INTEGER,
      beacon_interval INTEGER DEFAULT 100,
      stations        TEXT DEFAULT '[]',
      threats         TEXT DEFAULT '[]',
      ai_analysis     TEXT DEFAULT '{}',
      scan_id         TEXT,
      detected_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_networks_bssid      ON networks(bssid);
    CREATE INDEX IF NOT EXISTS idx_networks_detected   ON networks(detected_at);
    CREATE INDEX IF NOT EXISTS idx_networks_scan_id    ON networks(scan_id);

    CREATE TABLE IF NOT EXISTS locations (
      id          TEXT PRIMARY KEY,
      bssid       TEXT,
      ssid        TEXT,
      latitude    REAL,
      longitude   REAL,
      accuracy    REAL,
      altitude    REAL,
      heading     REAL,
      speed       REAL,
      user_consented INTEGER DEFAULT 0,
      timestamp   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_locations_bssid ON locations(bssid);
    CREATE INDEX IF NOT EXISTS idx_locations_ll    ON locations(latitude, longitude);

    CREATE TABLE IF NOT EXISTS threat_logs (
      id          TEXT PRIMARY KEY,
      ssid        TEXT,
      bssid       TEXT,
      threat_type TEXT,
      severity    TEXT,
      description TEXT,
      detected_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_threat_logs_detected ON threat_logs(detected_at);
  `);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function _row2threat(row) {
  if (!row) return null;
  return {
    id: row.id, _id: row.id,
    name: row.name,
    description: row.description,
    severity: row.severity,
    explanation: row.explanation,
    detectionMethods: row.detection_methods ? JSON.parse(row.detection_methods) : [],
    mitigation: row.mitigation,
    indicators: row.indicators ? JSON.parse(row.indicators) : [],
    source: row.source,
    discoveredDate: row.discovered_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    toObject: () => _row2threat(row),
  };
}

function _row2network(row) {
  if (!row) return null;
  return {
    id: row.id, _id: row.id,
    ssid: row.ssid, bssid: row.bssid,
    security: row.security,
    signal: row.signal,
    frequency: row.frequency,
    channel: row.channel,
    beaconInterval: row.beacon_interval,
    stations: row.stations ? JSON.parse(row.stations) : [],
    threats: row.threats ? JSON.parse(row.threats) : [],
    aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : {},
    scanId: row.scan_id,
    detectedAt: row.detected_at,
    networks: undefined,  // scan-history compat
    timestamp: new Date(row.detected_at).getTime(),
    toObject: () => _row2network(row),
  };
}

function _row2location(row) {
  if (!row) return null;
  return {
    id: row.id, _id: row.id,
    bssid: row.bssid, ssid: row.ssid,
    latitude: row.latitude, longitude: row.longitude,
    accuracy: row.accuracy, altitude: row.altitude,
    heading: row.heading, speed: row.speed,
    userConsented: !!row.user_consented,
    timestamp: row.timestamp,
    toObject: () => _row2location(row),
  };
}

function _row2threatLog(row) {
  if (!row) return null;
  return {
    id: row.id, _id: row.id,
    ssid: row.ssid, bssid: row.bssid,
    threatType: row.threat_type,
    severity: row.severity,
    description: row.description,
    detectedAt: row.detected_at,
    toObject: () => _row2threatLog(row),
  };
}

// ── Threats ───────────────────────────────────────────────────────────────────

const threats = {
  async add(data) {
    const id = _uuid();
    _db_().prepare(`
      INSERT INTO threats (id,name,description,severity,explanation,detection_methods,mitigation,indicators,source,discovered_date)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, data.name, data.description, data.severity, data.explanation,
      JSON.stringify(data.detectionMethods || []),
      data.mitigation,
      JSON.stringify(data.indicators || []),
      data.source,
      data.discoveredDate || null,
    );
    return _row2threat(_db_().prepare('SELECT * FROM threats WHERE id=?').get(id));
  },

  async getAll(filters = {}) {
    let sql = 'SELECT * FROM threats';
    const params = [];
    if (filters.severity) { sql += ' WHERE severity=?'; params.push(filters.severity); }
    sql += ' ORDER BY created_at DESC';
    return _db_().prepare(sql).all(...params).map(_row2threat);
  },

  async getById(id) {
    return _row2threat(_db_().prepare('SELECT * FROM threats WHERE id=?').get(id));
  },

  async update(id, updates) {
    const existing = _db_().prepare('SELECT * FROM threats WHERE id=?').get(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
    _db_().prepare(`
      UPDATE threats SET name=?,description=?,severity=?,explanation=?,
        detection_methods=?,mitigation=?,indicators=?,source=?,updated_at=?
      WHERE id=?
    `).run(
      merged.name, merged.description, merged.severity, merged.explanation,
      JSON.stringify(merged.detectionMethods || merged.detection_methods || []),
      merged.mitigation,
      JSON.stringify(merged.indicators || []),
      merged.source, merged.updated_at, id,
    );
    return _row2threat(_db_().prepare('SELECT * FROM threats WHERE id=?').get(id));
  },
};

// ── Submissions ───────────────────────────────────────────────────────────────

const submissions = {
  async add(data) {
    const id = _uuid();
    _db_().prepare('INSERT INTO submissions (id,name,description,status) VALUES (?,?,?,?)').run(
      id, data.name, data.description, data.status || 'pending',
    );
    return { id, ...data };
  },

  async getAll(filters = {}) {
    let sql = 'SELECT * FROM submissions';
    const params = [];
    if (filters.status) { sql += ' WHERE status=?'; params.push(filters.status); }
    sql += ' ORDER BY created_at DESC';
    return _db_().prepare(sql).all(...params).map(row => ({
      id: row.id, _id: row.id,
      name: row.name, description: row.description,
      status: row.status,
      researchResult: row.research_result ? JSON.parse(row.research_result) : null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  },

  async updateStatus(id, status, researchResult = null) {
    _db_().prepare('UPDATE submissions SET status=?,research_result=?,updated_at=? WHERE id=?').run(
      status, researchResult ? JSON.stringify(researchResult) : null,
      new Date().toISOString(), id,
    );
    const row = _db_().prepare('SELECT * FROM submissions WHERE id=?').get(id);
    return row ? { id: row.id, name: row.name, status: row.status } : null;
  },
};

// ── Networks ──────────────────────────────────────────────────────────────────

const networks = {
  async log(data) {
    const id = _uuid();
    _db_().prepare(`
      INSERT INTO networks (id,ssid,bssid,security,signal,frequency,channel,beacon_interval,stations,threats,ai_analysis,scan_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, data.ssid, data.bssid, data.security,
      data.signal, data.frequency, data.channel,
      data.beaconInterval || 100,
      JSON.stringify(data.stations || []),
      JSON.stringify(data.threats  || []),
      JSON.stringify(data.aiAnalysis || {}),
      data.scanId || null,
    );
    return { id };
  },

  async logBatch(items) {
    const insert = _db_().prepare(`
      INSERT INTO networks (id,ssid,bssid,security,signal,frequency,channel,beacon_interval,stations,threats,ai_analysis,scan_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const run = _db_().transaction((rows) => {
      for (const data of rows) {
        insert.run(
          _uuid(), data.ssid, data.bssid, data.security,
          data.signal, data.frequency, data.channel,
          data.beaconInterval || 100,
          JSON.stringify(data.stations  || []),
          JSON.stringify(data.threats   || []),
          JSON.stringify(data.aiAnalysis || {}),
          data.scanId || null,
        );
      }
    });
    run(items);
    return items;
  },

  async getRecent(limit = 100) {
    return _db_().prepare('SELECT * FROM networks ORDER BY detected_at DESC LIMIT ?')
      .all(limit).map(_row2network);
  },

  async searchBySSID(ssid) {
    return _db_().prepare('SELECT * FROM networks WHERE ssid=? ORDER BY detected_at DESC')
      .all(ssid).map(_row2network);
  },
};

// ── Locations ─────────────────────────────────────────────────────────────────

const locations = {
  async log(data) {
    const id = _uuid();
    _db_().prepare(`
      INSERT INTO locations (id,bssid,ssid,latitude,longitude,accuracy,altitude,heading,speed,user_consented)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, data.bssid, data.ssid, data.latitude, data.longitude,
      data.accuracy || null, data.altitude || null, data.heading || null,
      data.speed || null, data.userConsented ? 1 : 0,
    );
    return { id, ...data };
  },

  async getAll() {
    return _db_().prepare('SELECT * FROM locations ORDER BY timestamp DESC')
      .all().map(_row2location);
  },
};

// ── Threat logs ───────────────────────────────────────────────────────────────

const threatLogs = {
  async logBatch(findings) {
    if (!findings || findings.length === 0) return;
    const insert = _db_().prepare(`
      INSERT INTO threat_logs (id,ssid,bssid,threat_type,severity,description)
      VALUES (?,?,?,?,?,?)
    `);
    const run = _db_().transaction((rows) => {
      for (const f of rows) {
        insert.run(
          _uuid(),
          f.ssid || '',
          f.bssid || 'Unknown',
          f.reason ? f.reason.split('.')[0] : (f.threat || 'Unknown Threat'),
          f.severity || 'High',
          f.reason || f.description || '',
        );
      }
    });
    run(findings);
  },

  async getAll() {
    return _db_().prepare('SELECT * FROM threat_logs ORDER BY detected_at DESC LIMIT 1000')
      .all().map(_row2threatLog);
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

module.exports = { connect, threats, submissions, networks, locations, threatLogs };
