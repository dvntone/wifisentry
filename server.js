'use strict';

/**
 * WiFi Sentry — Fastify server entry point.
 *
 * Why Fastify instead of Express?
 *  - Same Node.js runtime (all native modules: node-wifi, better-sqlite3 work unchanged)
 *  - 2-3× faster JSON serialisation via compiled serialisers
 *  - First-class plugin system — every feature is a self-contained module
 *  - Built-in structured logging (pino), schema validation, and WebSocket support
 *  - Strict async error boundaries catch every unhandled rejection automatically
 *
 * Adding a new feature:
 *   1. Create routes/<feature>.js exporting  async function(fastify) { ... }
 *   2. Register it with  fastify.register(require('./routes/<feature>'))
 *   Nothing else changes.
 */

require('dotenv').config();

const path      = require('path');
const Fastify   = require('fastify');
const { authenticator } = require('otplib');
const qrcode    = require('qrcode');

const config            = require('./config');
const database          = require('./database');
const aiService         = require('./aiService');
const wifiScanner       = require('./wifi-scanner');
const locationTracker   = require('./location-tracker');
const dependencyChecker = require('./dependency-checker');
const platformInstaller = require('./platform-installer');
const { detectKarmaAttack } = require('./karma-attack');
const { detectEvilTwin }    = require('./evil-twin-detector');

// ── Create Fastify instance ───────────────────────────────────────────────────

const fastify = Fastify({
  logger: {
    level: config.environment === 'production' ? 'warn' : 'info',
    transport: config.environment !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// ── Register plugins ──────────────────────────────────────────────────────────

// CORS
fastify.register(require('@fastify/cors'), {
  origin:      process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Security headers — CSP is intentionally disabled here and applied per-context
// below. The public/ directory serves a pre-built Next.js static export whose
// HTML files contain inline <script> bootstrap blocks generated at build time.
// Because those files are immutable static assets, nonce injection at request
// time is not feasible. The strict Content-Security-Policy is therefore applied
// only on /api/* routes (which return JSON and never render HTML) via the
// onSend hook that follows this registration.
fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: false,
});

// Strict CSP applied to all API responses only (see comment above for reasoning).
const API_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' https://unpkg.com https://fonts.googleapis.com; img-src 'self' data: https: blob:; connect-src 'self' ws: wss:; font-src 'self' https://fonts.gstatic.com";

fastify.addHook('onSend', (request, reply, payload, done) => {
  if (request.url.startsWith('/api')) {
    reply.header('Content-Security-Policy', API_CSP);
  }
  done(null, payload);
});

// Rate limiting — general (100 req / 15 min)
fastify.register(require('@fastify/rate-limit'), {
  global:     true,
  max:        100,
  timeWindow: '15 minutes',
  errorResponseBuilder: () => ({
    error: 'Too many requests from this IP, please try again later.',
  }),
});

// Cookie
fastify.register(require('@fastify/cookie'));

// Session
fastify.register(require('@fastify/session'), {
  secret:      config.auth.sessionSecret,
  saveUninitialized: false,
  cookie: {
    secure:   config.environment === 'production',
    httpOnly: true,
    maxAge:   1000 * 60 * 60 * 24,  // 24 hours
  },
});

// Static files from public/
fastify.register(require('@fastify/static'), {
  root:   path.join(__dirname, 'public'),
  prefix: '/',
});

// ── Shared state decorators (accessible in all route plugins) ─────────────────

fastify.decorate('config',               config);
fastify.decorate('authenticator',        authenticator);
fastify.decorate('qrcode',               qrcode);
fastify.decorate('aiService',            aiService);
fastify.decorate('wifiScanner',          wifiScanner);
fastify.decorate('locationTracker',      locationTracker);
fastify.decorate('dependencyChecker',    dependencyChecker);
fastify.decorate('platformInstaller',    platformInstaller);
fastify.decorate('database',             database);
fastify.decorate('detectKarmaAttack',    detectKarmaAttack);
fastify.decorate('detectEvilTwin',       detectEvilTwin);

// Mutable runtime state
fastify.decorate('sseClients',               []);
fastify.decorate('monitoringInterval',       null);
fastify.decorate('locationTrackingConsent',  false);

// ── Route modules ─────────────────────────────────────────────────────────────

fastify.register(require('./routes/auth'));
fastify.register(require('./routes/scan'));
fastify.register(require('./routes/threats'));
fastify.register(require('./routes/locations'));
fastify.register(require('./routes/dependencies'));

// WiFi Adapter Management (optional — logs a warning if not available)
try {
  fastify.register(require('./api/adapters'));
  fastify.log.info('✓ WiFi Adapter Management API loaded');
} catch (err) {
  fastify.log.warn({ err }, '⚠ WiFi Adapter Management API not available');
}

// ── Health check ──────────────────────────────────────────────────────────────

fastify.get('/api/health', async (_request, reply) => {
  return reply.send({
    status:    'healthy',
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.1.10',
    db:        database.networks ? 'connected' : 'disconnected',
    features: {
      adapterManagement: true,
      locationTracking:  true,
      threatDetection:   true,
      twoFactorAuth:     true,
      sqlite:            true,
    },
  });
});

// ── Global error handler ──────────────────────────────────────────────────────

fastify.setErrorHandler((err, _request, reply) => {
  fastify.log.error({ err }, 'Unhandled error');
  reply.status(err.statusCode || 500).send({
    error: 'Internal server error',
    message: config.environment === 'development' ? err.message : undefined,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const start = async () => {
  await database.connect();

  const port = parseInt(process.env.PORT, 10) || config.port || 3000;
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`WiFi Sentry running on http://localhost:${port}`);
    fastify.log.info(`Environment: ${config.environment}`);
  } catch (err) {
    fastify.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

start();
