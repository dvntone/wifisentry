'use strict';

/**
 * Location routes: consent management, network location logging,
 * all locations, nearby network lookup.
 */

module.exports = async function locationRoutes(fastify) {
  const { database, locationTracker } = fastify;

  // ── Consent ───────────────────────────────────────────────────────────────

  fastify.post('/api/location-consent', async (request, reply) => {
    try {
      fastify.locationTrackingConsent = request.body.consent === true;
      return reply.send({
        message: `Location tracking ${fastify.locationTrackingConsent ? 'enabled' : 'disabled'}`,
        consent: fastify.locationTrackingConsent,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to set location consent', details: err.message });
    }
  });

  fastify.get('/api/location-consent', async (_request, reply) => {
    return reply.send({ consent: fastify.locationTrackingConsent });
  });

  // ── Log a network location ────────────────────────────────────────────────

  fastify.post('/api/log-location', async (request, reply) => {
    const { bssid, ssid, latitude, longitude, accuracy } = request.body;
    try {
      if (!fastify.locationTrackingConsent) {
        return reply.status(403).send({ error: 'Location tracking not consented' });
      }
      const location = await locationTracker.logNetworkLocation(
        { bssid, ssid },
        { latitude, longitude, accuracy },
        true
      );
      return reply.send({ message: 'Location logged', location });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to log location', details: err.message });
    }
  });

  // ── Retrieve locations ────────────────────────────────────────────────────

  fastify.get('/api/locations', async (_request, reply) => {
    try {
      if (!fastify.locationTrackingConsent) return reply.send([]);
      const locations = await locationTracker.getAllLocations(true);
      return reply.send(locations);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve locations', details: err.message });
    }
  });

  fastify.get('/api/nearby-networks', async (request, reply) => {
    try {
      const { latitude, longitude, radius } = request.query;
      if (!latitude || !longitude) {
        return reply.status(400).send({ error: 'Latitude and longitude required' });
      }
      const radiusKm = radius ? parseFloat(radius) / 1000 : 1;
      const nearby = await locationTracker.getNearbyNetworks(
        parseFloat(latitude),
        parseFloat(longitude),
        radiusKm
      );
      return reply.send(nearby);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve nearby networks', details: err.message });
    }
  });
};
