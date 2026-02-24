'use strict';

/**
 * Scan routes: SSE monitoring stream, start/stop monitoring,
 * scan history, WiGLE export, and CSV export.
 *
 * Shared mutable state (clients, monitoringInterval) is managed via
 * Fastify decorators set up in server.js.
 */

const { v4: uuidv4 } = require('uuid');

module.exports = async function scanRoutes(fastify) {
  const {
    wifiScanner,
    aiService,
    database,
    detectKarmaAttack,
    detectEvilTwin,
    locationTracker,
  } = fastify;

  // ── SSE broadcast helper ─────────────────────────────────────────────────

  function broadcast(data) {
    fastify.sseClients.forEach(client => {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }

  // ── Core scan logic ──────────────────────────────────────────────────────

  async function runScan(techniques) {
    try {
      const scannedNetworks = await wifiScanner.scan();
      const scanId = uuidv4();

      // Load recent scan history for history-aware threat checks
      let scanHistory = [];
      try {
        scanHistory = await wifiScanner.getScanHistory(20);
      } catch (histErr) {
        fastify.log.warn({ err: histErr }, 'Could not load scan history');
      }

      // Real-time AI analysis
      let aiAnalysisResult = {};
      try {
        aiAnalysisResult = await aiService.analyzeDetectionResults(scannedNetworks);
      } catch (aiErr) {
        fastify.log.error({ err: aiErr }, 'AI Analysis failed');
      }

      // Full heuristic analysis (13 checks, history-aware)
      let heuristicResult = { annotated: scannedNetworks, allThreats: [] };
      try {
        heuristicResult = await wifiScanner.analyzeThreatPatterns(scannedNetworks, scanHistory);
      } catch (heurErr) {
        fastify.log.error({ err: heurErr }, 'Heuristic analysis failed');
      }

      let findings = [];
      if (techniques.includes('karma')) {
        findings = findings.concat(detectKarmaAttack(scannedNetworks, scanHistory));
      }
      if (techniques.includes('evil-twin')) {
        findings = findings.concat(
          detectEvilTwin(scannedNetworks, scanHistory).map(f => ({ ...f, reason: `Evil Twin/Pineapple detected. ${f.reason}` }))
        );



      }

      // Merge heuristic threats not already captured
      const heuristicOnly = heuristicResult.allThreats.filter(t =>
        !findings.some(f => f.ssid === t.ssid && f.bssid === t.bssid)
      );
      findings = findings.concat(heuristicOnly);

      const networksToLog = heuristicResult.annotated.map(net => ({
        ssid: net.ssid,
        bssid: net.bssid,
        security: net.security,
        signal: net.signal_level || net.signal,
        frequency: net.frequency,
        channel: net.channel,
        beaconInterval: net.beaconInterval || 100,
        stations: [],
        scanId,
        threats: net.threats || [],
        aiAnalysis: aiAnalysisResult.suspicious_networks?.find(s => s.bssid === net.bssid)
          ? { risk: 'High', details: 'Flagged by AI as suspicious' }
          : { risk: 'Low' },
      }));

      await database.networks.logBatch(networksToLog);

      if (findings.length > 0) {
        await database.threatLogs.logBatch(findings);
      }

      broadcast({
        type: 'scan-result',
        timestamp: new Date().toLocaleTimeString(),
        networkCount: scannedNetworks.length,
        findings,
        networks: networksToLog,
      });
    } catch (err) {
      fastify.log.error({ err }, 'Scan error');
      broadcast({ type: 'error', message: err.message });
    }
  }

  // ── SSE monitoring stream ────────────────────────────────────────────────

  fastify.get('/api/monitoring-stream', (request, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const clientId = Date.now();
    fastify.sseClients.push({ id: clientId, res });

    request.raw.on('close', () => {
      const idx = fastify.sseClients.findIndex(c => c.id === clientId);
      if (idx !== -1) fastify.sseClients.splice(idx, 1);
    });
  });

  // ── Start / stop monitoring ──────────────────────────────────────────────

  fastify.post('/api/start-monitoring', async (request, reply) => {
    const { techniques } = request.body;
    if (!techniques || techniques.length === 0) {
      return reply.status(400).send({ error: 'No monitoring techniques selected.' });
    }

    if (fastify.monitoringInterval) {
      clearInterval(fastify.monitoringInterval);
    }

    fastify.log.info({ techniques }, 'Starting continuous monitoring');
    runScan(techniques);
    fastify.monitoringInterval = setInterval(() => runScan(techniques), 10000);

    return reply.send({ message: 'Continuous monitoring started.' });
  });

  fastify.post('/api/stop-monitoring', async (_request, reply) => {
    if (fastify.monitoringInterval) {
      clearInterval(fastify.monitoringInterval);
      fastify.monitoringInterval = null;
    }
    return reply.send({ message: 'Monitoring stopped.' });
  });

  // ── Scan history ─────────────────────────────────────────────────────────

  fastify.get('/api/scan-history', async (request, reply) => {
    try {
      const limit = parseInt(request.query.limit) || 50;
      const networks = await wifiScanner.getScanHistory(limit);
      return reply.send(networks);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve scan history', details: err.message });
    }
  });

  // ── CSV export ────────────────────────────────────────────────────────────

  function threatsToCsv(threats) {
    if (!threats || threats.length === 0) return '';

    const headers = ['id', 'name', 'severity', 'description', 'explanation', 'detectionMethods', 'mitigation', 'indicators', 'source', 'discoveredDate', 'createdAt', 'updatedAt'];

    const escapeCell = (cell) => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = threats.map(threatDoc => {
      const threat = threatDoc.toObject ? threatDoc.toObject({ virtuals: true }) : threatDoc;
      return headers.map(header => {
        let value = threat[header];
        if (Array.isArray(value)) value = value.join('; ');
        return escapeCell(value);
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  fastify.get('/api/export/threats-csv', async (_request, reply) => {
    try {
      const allThreats = await database.threats.getAll();
      const csvData = threatsToCsv(allThreats);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="threats.csv"');
      return reply.send(csvData);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to export threats', details: err.message });
    }
  });

  // ── WiGLE export ─────────────────────────────────────────────────────────

  fastify.post('/api/export-wigle', async (request, reply) => {
    try {
      const { startDate, endDate } = request.body;
      const networks = await database.networks.getRecent(1000);
      const filtered = networks.filter(n => {
        if (startDate && new Date(n.detectedAt) < new Date(startDate)) return false;
        if (endDate && new Date(n.detectedAt) > new Date(endDate)) return false;
        return true;
      });

      const formatted = locationTracker.formatForWigle(filtered);
      return reply.send({
        message: 'Export data formatted for WiGLE.net',
        count: filtered.length,
        csv: formatted.csv,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to export data', details: err.message });
    }
  });
};
