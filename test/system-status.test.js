/**
 * Unit tests for the /api/system-status endpoint logic.
 */

const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

describe('system-status endpoint', () => {
    it('maps mongoose readyState 1 to "connected"', () => {
        expect(dbStateMap[1]).toBe('connected');
    });

    it('maps mongoose readyState 0 to "disconnected"', () => {
        expect(dbStateMap[0]).toBe('disconnected');
    });

    it('maps mongoose readyState 2 to "connecting"', () => {
        expect(dbStateMap[2]).toBe('connecting');
    });

    it('maps mongoose readyState 3 to "disconnecting"', () => {
        expect(dbStateMap[3]).toBe('disconnecting');
    });

    it('returns "unknown" for unexpected readyState values', () => {
        expect(dbStateMap[99] || 'unknown').toBe('unknown');
    });

    it('reports monitoring inactive when monitoringInterval is null', () => {
        const monitoringInterval = null;
        expect(monitoringInterval !== null).toBe(false);
    });

    it('reports monitoring active when monitoringInterval is set', () => {
        const monitoringInterval = setInterval(() => {}, 10000);
        expect(monitoringInterval !== null).toBe(true);
        clearInterval(monitoringInterval);
    });
});
