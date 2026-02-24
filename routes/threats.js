'use strict';

/**
 * Threat routes: AI-catalogued threats, user submissions, threat logs.
 */

module.exports = async function threatRoutes(fastify) {
  const { aiService, database } = fastify;

  /** Prehandler hook that enforces an authenticated session. */
  async function requireAuth(request, reply) {
    if (!request.session.user) {
      return reply.status(401).send({ error: 'Unauthorized: Please log in.' });
    }
  }

  // ── Submit new threat technique for AI research ───────────────────────────

  fastify.post('/api/submit-technique', async (request, reply) => {
    const { name, description } = request.body;
    if (!name || !description) {
      return reply.status(400).send({ error: 'Technique name and description are required.' });
    }
    try {
      const newThreat = await aiService.researchTechnique({ name, description, source: 'User Submission' });
      return reply.status(201).send(newThreat);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to submit technique for research.', details: err.message });
    }
  });

  // ── Catalogued threats ────────────────────────────────────────────────────

  fastify.get('/api/cataloged-threats', async (request, reply) => {
    try {
      const { severity } = request.query;
      const threats = severity
        ? await aiService.getThreatsBySeverity(severity)
        : await aiService.getCatalogedThreats();
      return reply.send(threats);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve cataloged threats.', details: err.message });
    }
  });

  fastify.get('/api/cataloged-threats/:id', async (request, reply) => {
    try {
      const threat = await database.threats.getById(request.params.id);
      if (!threat) return reply.status(404).send({ error: 'Threat not found' });
      return reply.send(threat);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve threat', details: err.message });
    }
  });

  // ── Detected threat logs (authenticated) ─────────────────────────────────

  fastify.get('/api/threat-logs', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const logs = await database.threatLogs.getAll();
      return reply.send(logs);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve threat logs', details: err.message });
    }
  });

  // ── User submissions ──────────────────────────────────────────────────────

  fastify.get('/api/submissions', async (request, reply) => {
    try {
      const { status } = request.query;
      const submissions = await database.submissions.getAll(status ? { status } : {});
      return reply.send(submissions);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve submissions', details: err.message });
    }
  });

  fastify.get('/api/submissions/:id', async (request, reply) => {
    try {
      const submissions = await database.submissions.getAll();
      const submission = submissions.find(s => s.id === request.params.id);
      if (!submission) return reply.status(404).send({ error: 'Submission not found' });
      return reply.send(submission);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve submission', details: err.message });
    }
  });
};
