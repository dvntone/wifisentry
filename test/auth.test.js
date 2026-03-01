const Fastify = require('fastify');
const authRoutes = require('../routes/auth');
const config = require('../config');

// Mock decorators
const mockSpeakeasy = {
  generateSecret: jest.fn(() => ({ base32: 'test-secret', otpauth_url: 'otpauth://test' })),
  totp: {
    verify: jest.fn(() => true),
  },
};
const mockQrcode = {
  toDataURL: jest.fn((url, cb) => cb(null, 'data:image/png;base64,test')),
};

describe('Auth Routes', () => {
  let fastify;

  beforeEach(async () => {
    fastify = Fastify();
    
    // Decorate fastify with mocks needed by authRoutes
    fastify.decorate('config', config);
    fastify.decorate('speakeasy', mockSpeakeasy);
    fastify.decorate('qrcode', mockQrcode);
    
    // Mock session (simple version for testing)
    fastify.addHook('preHandler', (request, reply, done) => {
      request.session = request.session || {};
      done();
    });

    fastify.register(authRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: config.auth.adminUsername,
          password: config.auth.adminPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Login successful.');
    });

    it('should fail with incorrect credentials', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'wrong-user',
          password: 'wrong-password',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Mock session.destroy
      fastify.addHook('preHandler', (request, reply, done) => {
        request.session = {
          destroy: (cb) => cb(null),
        };
        done();
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
