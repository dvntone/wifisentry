'use strict';

/**
 * Location routes: consent management, network location logging,
 * all locations, nearby network lookup.
 */

const Joi = require('joi');

// ── Validation schemas ────────────────────────────────────────────────────────

const locationConsentSchema = Joi.object({
  consent: Joi.boolean().required(),
});

const logLocationSchema = Joi.object({
  bssid:     Joi.string().max(64).required(),
  ssid:      Joi.string().max(128).required(),
  latitude:  Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracy:  Joi.number().min(0).max(100000).optional(),
});

module.exports = async function locationRoutes(fastify) {
  const { database, locationTracker } = fastify;

  // ── Consent ───────────────────────────────────────────────────────────────

  fastify.post('/api/location-consent', async (request, reply) => {
    try {
      const { error, value } = locationConsentSchema.validate(request.body);
      if (error) return reply.status(400).send({ error: error.details[0].message });
      fastify.locationTrackingConsent = value.consent;
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
    const { error, value } = logLocationSchema.validate(request.body);
    if (error) return reply.status(400).send({ error: error.details[0].message });
    const { bssid, ssid, latitude, longitude, accuracy } = value;
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
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return reply.status(400).send({ error: 'Invalid latitude (must be -90 to 90)' });
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        return reply.status(400).send({ error: 'Invalid longitude (must be -180 to 180)' });
      }
      const rawRadius = radius ? parseFloat(radius) : 1000;
      if (isNaN(rawRadius) || rawRadius <= 0 || rawRadius > 100000) {
        return reply.status(400).send({ error: 'Invalid radius (must be 1 to 100000 metres)' });
      }
      const radiusKm = rawRadius / 1000;
      const nearby = await locationTracker.getNearbyNetworks(lat, lon, radiusKm);
      return reply.send(nearby);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to retrieve nearby networks', details: err.message });
    }
  });
};
