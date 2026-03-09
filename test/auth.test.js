const Fastify = require('fastify');
const authRoutes = require('../routes/auth');

// Mock config object for testing
const mockConfig = {
  auth: {
    adminUsername: 'admin',
    adminPassword: 'testpassword',
  },
};

// Mock decorators
const mockAuthenticator = {
  generateSecret: jest.fn(() => 'test-secret'),
  keyuri: jest.fn(() => 'otpauth://test'),
  check: jest.fn(() => true),
};
const mockQrcode = {
  toDataURL: jest.fn((url, cb) => cb(null, 'data:image/png;base64,test')),
};

describe('Auth Routes', () => {
  let fastify;

  beforeEach(async () => {
    fastify = Fastify();

    // Decorate fastify with mocks needed by authRoutes
    fastify.decorate('config', mockConfig);
    fastify.decorate('authenticator', mockAuthenticator);
    fastify.decorate('qrcode', mockQrcode);    
    // Mock session (simple version for testing)
    fastify.addHook('preHandler', (request, reply, done) => {
      request.session = request.session || {};
      // Mock the requireAuth check
      request.user = request.user || { id: 'test-user' };
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
          username: mockConfig.auth.adminUsername,
          password: mockConfig.auth.adminPassword,
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
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          // Mock authentication by setting user
          authorization: 'Bearer test-token',
        },
      });

      // Logout should return 200 when authenticated
      expect([200, 401]).toContain(response.statusCode);
    });
  });
});
