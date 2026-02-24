/**
 * Database module — MongoDB primary with automatic SQLite fallback.
 *
 * DB_TYPE=auto (default): try MongoDB; if the connection fails within
 *   MONGO_CONNECT_TIMEOUT_MS, transparently switch to the embedded SQLite
 *   adapter so the app runs with zero external infrastructure.
 * DB_TYPE=mongodb: require MongoDB (throw on failure).
 * DB_TYPE=sqlite:  always use the embedded SQLite adapter.
 *
 * All callers use the same interface regardless of which adapter is active.
 */

const mongoose = require('mongoose');
const config = require('./config');

const MONGO_CONNECT_TIMEOUT_MS = 5000;

// ── Active adapter reference (set in connect()) ───────────────────────────────
let _adapter = null;

/**
 * Connect to the configured database.
 * Sets the module-level `threats`, `submissions`, `networks`, `locations`,
 * `threatLogs` exports to the chosen adapter's implementations.
 */
const connect = async () => {
  const dbType = process.env.DB_TYPE || 'auto';

  if (dbType === 'sqlite') {
    return _useSQLite('DB_TYPE=sqlite');
  }

  // Try MongoDB
  try {
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
      connectTimeoutMS:         MONGO_CONNECT_TIMEOUT_MS,
    });
    console.log('[DB] Connected to MongoDB');
    _useMongoose();
  } catch (error) {
    if (dbType === 'mongodb') {
      console.error('[DB] MongoDB connection failed (DB_TYPE=mongodb):', error.message);
      throw error;
    }
    // auto mode — fall back to SQLite
    console.warn('[DB] MongoDB unavailable, falling back to embedded SQLite:', error.message);
    _useSQLite('MongoDB unreachable');
  }
};

function _useSQLite(reason) {
  const sqlite = require('./database-sqlite');
  sqlite.connect();
  _adapter = sqlite;
  // Proxy module-level exports to the SQLite adapter
  Object.assign(module.exports, {
    threats:     sqlite.threats,
    submissions: sqlite.submissions,
    networks:    sqlite.networks,
    locations:   sqlite.locations,
    threatLogs:  sqlite.threatLogs,
  });
  console.log(`[DB] Using embedded SQLite adapter (${reason})`);
}

function _useMongoose() {
  // Proxy module-level exports to the Mongoose implementations defined below
  Object.assign(module.exports, {
    threats:     _mongoThreats,
    submissions: _mongoSubmissions,
    networks:    _mongoNetworks,
    locations:   _mongoLocations,
    threatLogs:  _mongoThreatLogs,
  });
}

// --- Schemas ---

const threatSchema = new mongoose.Schema({
  name: String,
  description: String,
  severity: String,
  explanation: String,
  detectionMethods: [String],
  mitigation: String,
  indicators: [String],
  source: String,
  discoveredDate: Date,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const submissionSchema = new mongoose.Schema({
  name: String,
  description: String,
  status: { type: String, default: 'pending' },
  researchResult: mongoose.Schema.Types.Mixed,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const networkSchema = new mongoose.Schema({
  ssid: String,
  bssid: String,
  security: String,
  signal: Number,
  frequency: Number,
  channel: Number,
  beaconInterval: Number,
  stations: [String],
  aiAnalysis: mongoose.Schema.Types.Mixed,
  scanId: String,
  detectedAt: { type: Date, default: Date.now },
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const locationSchema = new mongoose.Schema({
  bssid: String,
  ssid: String,
  latitude: Number,
  longitude: Number,
  accuracy: Number,
  altitude: Number,
  heading: Number,
  speed: Number,
  userConsented: Boolean,
  timestamp: { type: Date, default: Date.now },
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const threatLogSchema = new mongoose.Schema({
  ssid: String,
  bssid: String,
  threatType: String,
  severity: String,
  description: String,
  detectedAt: { type: Date, default: Date.now },
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

// --- Models ---

const Threat = mongoose.model('Threat', threatSchema);
const Submission = mongoose.model('Submission', submissionSchema);
const Network = mongoose.model('Network', networkSchema);
const Location = mongoose.model('Location', locationSchema);
const ThreatLog = mongoose.model('ThreatLog', threatLogSchema);

// Mongoose implementations (used when MongoDB is active)
let _mongoThreats, _mongoSubmissions, _mongoNetworks, _mongoLocations, _mongoThreatLogs;

// Threat operations
_mongoThreats = {
  /**
   * Add a new threat to the catalog
   */
  async add(threatData) {
    try {
      const threat = new Threat(threatData);
      return await threat.save();
    } catch (error) {
      console.error('Error adding threat:', error);
      throw error;
    }
  },

  /**
   * Get all threats
   */
  async getAll(filters = {}) {
    try {
      const query = {};
      if (filters.severity) {
        query.severity = filters.severity;
      }
      return await Threat.find(query).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching threats:', error);
      throw error;
    }
  },

  /**
   * Get threat by ID
   */
  async getById(id) {
    try {
      return await Threat.findById(id);
    } catch (error) {
      console.error('Error fetching threat:', error);
      throw error;
    }
  },

  /**
   * Update threat
   */
  async update(id, updates) {
    try {
      return await Threat.findByIdAndUpdate(id, updates, { new: true });
    } catch (error) {
      console.error('Error updating threat:', error);
      throw error;
    }
  },
};

// User submission operations
_mongoSubmissions = {
  /**
   * Add a new threat submission
   */
  async add(submissionData) {
    try {
      const submission = new Submission(submissionData);
      return await submission.save();
    } catch (error) {
      console.error('Error adding submission:', error);
      throw error;
    }
  },

  /**
   * Get all submissions
   */
  async getAll(filters = {}) {
    try {
      const query = {};
      if (filters.status) {
        query.status = filters.status;
      }
      return await Submission.find(query).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  },

  /**
   * Update submission status
   */
  async updateStatus(id, status, researchResult = null) {
    try {
      const updates = { status };
      if (researchResult) updates.researchResult = researchResult;
      return await Submission.findByIdAndUpdate(id, updates, { new: true });
    } catch (error) {
      console.error('Error updating submission:', error);
      throw error;
    }
  },
};

// WiFi network tracking operations
_mongoNetworks = {
  /**
   * Log a detected network
   */
  async log(networkData) {
    try {
      const network = new Network(networkData);
      return await network.save();
    } catch (error) {
      console.error('Error logging network:', error);
      throw error;
    }
  },

  /**
   * Log a batch of networks
   */
  async logBatch(networksData) {
    try {
      return await Network.insertMany(networksData);
    } catch (error) {
      console.error('Error logging network batch:', error);
      throw error;
    }
  },

  /**
   * Get recent networks
   */
  async getRecent(limit = 100) {
    try {
      return await Network.find().sort({ detectedAt: -1 }).limit(limit);
    } catch (error) {
      console.error('Error fetching networks:', error);
      throw error;
    }
  },

  /**
   * Search networks by SSID
   */
  async searchBySSID(ssid) {
    try {
      return await Network.find({ ssid }).sort({ detectedAt: -1 });
    } catch (error) {
      console.error('Error searching networks:', error);
      throw error;
    }
  },
};

// Location tracking operations
_mongoLocations = {
  /**
   * Log a network location
   */
  async log(locationData) {
    try {
      const location = new Location(locationData);
      return await location.save();
    } catch (error) {
      console.error('Error logging location:', error);
      throw error;
    }
  },

  /**
   * Get all locations
   */
  async getAll() {
    try {
      return await Location.find().sort({ timestamp: -1 });
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },
};

// Threat Log operations (Detected threats)
_mongoThreatLogs = {
  /**
   * Log a batch of detected threats
   */
  async logBatch(findings) {
    try {
      if (!findings || findings.length === 0) return;
      
      const logs = findings.map(f => ({
        ssid: f.ssid,
        bssid: f.bssid || 'Unknown',
        threatType: f.reason ? f.reason.split('.')[0] : 'Unknown Threat', // Simple extraction
        severity: f.severity || 'High',
        description: f.reason || f.description,
        detectedAt: new Date(),
      }));
      
      return await ThreatLog.insertMany(logs);
    } catch (error) {
      console.error('Error logging threat batch:', error);
      throw error;
    }
  },

  /**
   * Get threat statistics for dashboard
   */
  async getAll() {
    try {
      return await ThreatLog.find().sort({ detectedAt: -1 }).limit(1000);
    } catch (error) {
      console.error('Error fetching threat logs:', error);
      throw error;
    }
  },
};

/** Stub that throws a clear error if a DB method is called before connect(). */
function _notConnected() {
  return new Proxy({}, {
    get: (_t, prop) => () => { throw new Error(`Database not connected — call connect() before using database.${prop}()`); },
  });
}

module.exports = {
  connect,
  // Replaced at runtime by connect() with the active adapter's implementations.
  threats:     _notConnected(),
  submissions: _notConnected(),
  networks:    _notConnected(),
  locations:   _notConnected(),
  threatLogs:  _notConnected(),
};
