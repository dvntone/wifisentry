'use strict';

const Joi = require('joi');

/**
 * Auth routes: login, logout, and 2FA setup/verify.
 * Registers as a Fastify plugin so it has access to fastify.config,
 * fastify.authenticator, and fastify.qrcode decorators set up in server.js.
 */

const path = require('path');

module.exports = async function authRoutes(fastify) {
  const { config, authenticator, qrcode } = fastify;

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Prehandler hook that enforces an authenticated session. */
  async function requireAuth(request, reply) {
    if (!request.session.user) {
      if (request.url.startsWith('/api/')) {
        return reply.status(401).send({ error: 'Unauthorized: Please log in.' });
      }
      return reply.redirect('/login.html');
    }
  }

  // ── page routes ───────────────────────────────────────────────────────────

  fastify.get('/', async (_request, reply) => {
    return reply.sendFile('index.html');
  });

  fastify.get('/login.html', async (_request, reply) => {
    return reply.sendFile('login.html');
  });

  fastify.get('/dashboard.html', {
    preHandler: requireAuth,
  }, async (_request, reply) => {
    return reply.sendFile('dashboard.html');
  });

  fastify.get('/2fa-verify.html', async (_request, reply) => {
    return reply.sendFile('2fa-verify.html');
  });

  // ── auth API ──────────────────────────────────────────────────────────────

  fastify.get('/api/auth/2fa/generate', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(config.auth.adminUsername, 'WiFi Sentry', secret);
    request.session.temp2faSecret = secret;

    return new Promise((resolve, reject) => {
      qrcode.toDataURL(otpauthUrl, (err, dataUrl) => {
        if (err) {
          reject(reply.status(500).send({ message: 'Could not generate QR code.' }));
        } else {
          resolve(reply.send({ qrCodeUrl: dataUrl, secret }));
        }
      });
    });
  });

  fastify.post('/api/auth/2fa/enable', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const { error: validErr, value: body } = Joi.object({ token: Joi.string().pattern(/^\d{6,8}$/).required() }).validate(request.body);
    if (validErr) return reply.status(400).send({ success: false, message: 'Invalid token format.' });
    const { token } = body;
    const secret = request.session.temp2faSecret;

    if (!secret) {
      return reply.status(400).send({ success: false, message: '2FA setup not started. Please generate a QR code first.' });
    }

    const verified = authenticator.check(token, secret);

    if (verified) {
      delete request.session.temp2faSecret;
      return reply.send({ success: true, message: 'Verification successful! Add the secret to your .env file as ADMIN_2FA_SECRET and restart the server.' });
    }
    return reply.status(400).send({ success: false, message: 'Invalid token. Please try again.' });
  });

  fastify.post('/api/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const loginSchema = Joi.object({
      username: Joi.string().max(255).required(),
      password: Joi.string().max(1024).required(),
    });
    const { error: validErr, value: body } = loginSchema.validate(request.body);
    if (validErr) return reply.status(400).send({ success: false, message: 'Invalid request body.' });
    const { username, password } = body;
    if (username === config.auth.adminUsername && password === config.auth.adminPassword) {
      if (config.auth.adminTwoFactorSecret) {
        request.session.awaiting2fa = true;
        return reply.send({ success: true, twoFactorRequired: true });
      }
      request.session.user = { username, loggedInAt: Date.now() };
      return reply.send({ success: true, message: 'Login successful.' });
    }
    return reply.status(401).send({ success: false, message: 'Invalid username or password.' });
  });

  fastify.post('/api/auth/2fa/verify', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const { error: validErr, value: body } = Joi.object({ token: Joi.string().pattern(/^\d{6,8}$/).required() }).validate(request.body);
    if (validErr) return reply.status(400).send({ success: false, message: 'Invalid token format.' });
    const { token } = body;

    if (!request.session.awaiting2fa) {
      return reply.status(401).send({ success: false, message: 'Please log in with your password first.' });
    }

    const verified = authenticator.check(token, config.auth.adminTwoFactorSecret);

    if (verified) {
      delete request.session.awaiting2fa;
      request.session.user = { username: config.auth.adminUsername, loggedInAt: Date.now() };
      return reply.send({ success: true, message: 'Verification successful.' });
    }
    return reply.status(401).send({ success: false, message: 'Invalid 2FA token.' });
  });

  fastify.post('/api/auth/logout', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    return new Promise((resolve) => {
      request.session.destroy((err) => {
        if (err) {
          resolve(reply.status(500).send({ message: 'Could not log out.' }));
        } else {
          reply.clearCookie('sessionId');
          resolve(reply.send({ success: true, message: 'Successfully logged out.' }));
        }
      });
    });
  });
};
