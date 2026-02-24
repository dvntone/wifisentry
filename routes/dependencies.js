'use strict';

/**
 * Dependency and platform setup routes.
 * Wraps dependency-checker and platform-installer modules.
 */

module.exports = async function dependencyRoutes(fastify) {
  const { dependencyChecker, platformInstaller } = fastify;

  // ── Dependency checker ────────────────────────────────────────────────────

  fastify.get('/api/dependencies/check', async (_request, reply) => {
    try {
      return reply.send(dependencyChecker.checkAllDependencies());
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to check dependencies', details: err.message });
    }
  });

  fastify.get('/api/dependencies/critical', async (_request, reply) => {
    try {
      const critical = dependencyChecker.getCriticalMissingDependencies();
      return reply.send({ hasCriticalMissing: critical.length > 0, count: critical.length, dependencies: critical });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to check critical dependencies', details: err.message });
    }
  });

  fastify.get('/api/dependencies/:toolId/install', async (request, reply) => {
    try {
      const instructions = dependencyChecker.getInstallationInstructions(request.params.toolId);
      if (!instructions) return reply.status(404).send({ error: 'Tool not found' });
      return reply.send(instructions);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get installation instructions', details: err.message });
    }
  });

  fastify.post('/api/dependencies/:toolId/install', async (request, reply) => {
    try {
      const result = await dependencyChecker.installDependency(request.params.toolId, request.body || {});
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: typeof err === 'string' ? err : err.error || 'Installation failed',
        details: err.details || err.message,
      });
    }
  });

  // ── Platform setup ────────────────────────────────────────────────────────

  fastify.get('/api/setup/environment', async (_request, reply) => {
    try {
      return reply.send(platformInstaller.getSetupGuide());
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get setup guide', details: err.message });
    }
  });

  fastify.post('/api/setup/install-script', async (request, reply) => {
    try {
      const { toolIds = [], update = true } = request.body;
      return reply.send(platformInstaller.generateInstallScript(toolIds, { update }));
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to generate installation script', details: err.message });
    }
  });

  fastify.get('/api/setup/check-critical', async (_request, reply) => {
    try {
      return reply.send(platformInstaller.checkCriticalTools());
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to check critical tools', details: err.message });
    }
  });
};
