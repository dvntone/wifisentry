// Mock Google Gemini AI
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return null; // Return null so aiService uses mock path
        }),
      };
    }),
  };
});

const aiService = require('../aiService');
const database = require('../database');

// Mock database
jest.mock('../database', () => ({
  threats: {
    add: jest.fn(t => Promise.resolve({ id: 'test-id', ...t })),
    getAll: jest.fn(() => Promise.resolve([])),
    getById: jest.fn(id => Promise.resolve({ id, name: 'Test Threat' })),
  },
}));

describe('AI Service Unit Tests', () => {
  describe('analyzeThreat', () => {
    it('should return a threat analysis (mock path)', async () => {
      const threatData = {
        name: 'Evil Twin',
        description: 'Attacker creates a rogue AP with same SSID as a legitimate one.',
      };
      
      const analysis = await aiService.analyzeThreat(threatData);
      
      expect(analysis).toHaveProperty('severity');
      expect(analysis).toHaveProperty('explanation');
      expect(analysis.name).toBe(threatData.name);
      expect(analysis.description).toBe(threatData.description);
    });
  });

  describe('researchTechnique', () => {
    it('should research and save a new technique', async () => {
      const techniqueData = {
        name: 'Karma Attack',
        description: 'AP responds to probe requests for any SSID.',
        source: 'User Submission',
      };
      
      const savedThreat = await aiService.researchTechnique(techniqueData);
      
      expect(savedThreat.name).toBe(techniqueData.name);
      expect(savedThreat.id).toBe('test-id');
      expect(database.threats.add).toHaveBeenCalled();
    });
  });

  describe('getCatalogedThreats', () => {
    it('should retrieve all cataloged threats', async () => {
      const threats = await aiService.getCatalogedThreats();
      expect(Array.isArray(threats)).toBe(true);
      expect(database.threats.getAll).toHaveBeenCalled();
    });
  });

  describe('analyzeDetectionResults', () => {
    it('should analyze detection results for suspicious patterns (mock path)', async () => {
      const networks = [
        { ssid: 'Free WiFi', bssid: '00:11:22:33:44:55', security: 'OPEN' },
        { ssid: 'Home WiFi', bssid: 'AA:BB:CC:DD:EE:FF', security: 'WPA2' },
      ];
      
      const analysis = await aiService.analyzeDetectionResults(networks);
      
      expect(analysis).toHaveProperty('suspicious_networks');
      expect(analysis.suspicious_networks).toHaveLength(1);
      expect(analysis.suspicious_networks[0].ssid).toBe('Free WiFi');
    });
  });
});
