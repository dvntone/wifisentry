'use strict';

const Joi = require('joi');

const toolIdValidator = Joi.string().alphanum().max(64).required();

/**
 * Dependency and platform setup routes.
 * Wraps dependency-checker and platform-installer modules.
 */

module.exports = async function dependencyRoutes(fastify) {
  const { dependencyChecker, platformInstaller } = fastify;

  async function requireAuth(request, reply) {
    if (!request.session?.user) {
      return reply.status(401).send({ error: 'Unauthorized: Please log in.' });
    }
  }

  // ── Dependency checker ────────────────────────────────────────────────────

  fastify.get('/api/dependencies/check', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      return reply.send(dependencyChecker.checkAllDependencies());
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to check dependencies', details: err.message });
    }
  });

  fastify.get('/api/dependencies/critical', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const critical = dependencyChecker.getCriticalMissingDependencies();
      return reply.send({ hasCriticalMissing: critical.length > 0, count: critical.length, dependencies: critical });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to check critical dependencies', details: err.message });
    }
  });

  fastify.get('/api/dependencies/:toolId/install', { preHandler: requireAuth }, async (request, reply) => {
    try {
      if (toolIdValidator.validate(request.params.toolId).error) {
        return reply.status(400).send({ error: 'Invalid tool ID.' });
      }
      const instructions = dependencyChecker.getInstallationInstructions(request.params.toolId);
      if (!instructions) return reply.status(404).send({ error: 'Tool not found' });
      return reply.send(instructions);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get installation instructions', details: err.message });
    }
  });

  fastify.post('/api/dependencies/:toolId/install', { preHandler: requireAuth }, async (request, reply) => {
    try {
      if (toolIdValidator.validate(request.params.toolId).error) {
        return reply.status(400).send({ error: 'Invalid tool ID.' });
      }
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

  fastify.get('/api/setup/environment', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      return reply.send(platformInstaller.getSetupGuide());
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get setup guide', details: err.message });
    }
  });

  fastify.post('/api/setup/install-script', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const schema = Joi.object({
        toolIds: Joi.array().items(Joi.string().alphanum().max(64)).default([]),
        update:  Joi.boolean().default(true),
      });
      const { error: validErr, value: body } = schema.validate(request.body || {});
      if (validErr) return reply.status(400).send({ error: 'Invalid request body.' });
      const { toolIds, update } = body;
      return reply.send(platformInstaller.generateInstallScript(toolIds, { update }));
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to generate installation script', details: err.message });
    }
  });

  fastify.get('/api/setup/check-critical', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      return reply.send(platformInstaller.checkCriticalTools());
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to check critical tools', details: err.message });
    }
  });
};
