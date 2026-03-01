const {
  checkOpenNetwork,
  checkSuspiciousKeyword,
  checkMacSpoofing,
  checkSuspiciousRssi,
  ouiOf,
  bandOf,
  isOpenSecurity,
  SUSPICIOUS_KEYWORDS,
} = require('../wifi-scanner');

describe('WiFi Scanner Unit Tests', () => {
  describe('checkOpenNetwork', () => {
    it('should return true for open networks', () => {
      expect(checkOpenNetwork({ security: '' })).toBe(true);
      expect(checkOpenNetwork({ security: 'NONE' })).toBe(true);
      expect(checkOpenNetwork({ security: 'Open' })).toBe(true);
    });

    it('should return false for secured networks', () => {
      expect(checkOpenNetwork({ security: 'WPA2' })).toBe(false);
      expect(checkOpenNetwork({ security: 'WPA3-SAE' })).toBe(false);
      expect(checkOpenNetwork({ security: 'WEP' })).toBe(false);
    });
  });

  describe('checkSuspiciousKeyword', () => {
    it('should return true if SSID contains suspicious keyword', () => {
      expect(checkSuspiciousKeyword('Free WiFi')).toBe(true);
      expect(checkSuspiciousKeyword('Pineapple_123')).toBe(true);
      expect(checkSuspiciousKeyword('Starbucks_Guest')).toBe(true);
    });

    it('should return false for normal SSIDs', () => {
      expect(checkSuspiciousKeyword('MyHomeNetwork')).toBe(false);
      expect(checkSuspiciousKeyword('Office_WiFi')).toBe(false);
    });
  });

  describe('checkMacSpoofing', () => {
    it('should return true for locally-administered MAC addresses', () => {
      // Bit 1 of first octet set (02, 06, 0A, 0E, etc.)
      expect(checkMacSpoofing({ bssid: '02:00:00:00:00:00' }, new Set())).toBe(true);
      expect(checkMacSpoofing({ bssid: 'AE:00:00:00:00:00' }, new Set())).toBe(true);
    });

    it('should return false for globally-administered MAC addresses', () => {
      expect(checkMacSpoofing({ bssid: '00:11:22:33:44:55' }, new Set())).toBe(false);
      expect(checkMacSpoofing({ bssid: 'A8:20:66:00:00:00' }, new Set())).toBe(false);
    });

    it('should return false if BSSID is already in knownBssids', () => {
      const known = new Set(['02:00:00:00:00:00']);
      expect(checkMacSpoofing({ bssid: '02:00:00:00:00:00' }, known)).toBe(false);
    });
  });

  describe('checkSuspiciousRssi', () => {
    it('should return true for new BSSID with very strong signal', () => {
      const known = new Set(['AA:BB:CC:DD:EE:FF']);
      const net = { bssid: '11:22:33:44:55:66', signal_level: -30 };
      expect(checkSuspiciousRssi(net, known)).toBe(true);
    });

    it('should return false if BSSID is known', () => {
      const known = new Set(['11:22:33:44:55:66']);
      const net = { bssid: '11:22:33:44:55:66', signal_level: -30 };
      expect(checkSuspiciousRssi(net, known)).toBe(false);
    });

    it('should return false if signal is weak', () => {
      const known = new Set(['AA:BB:CC:DD:EE:FF']);
      const net = { bssid: '11:22:33:44:55:66', signal_level: -70 };
      expect(checkSuspiciousRssi(net, known)).toBe(false);
    });
  });

  describe('ouiOf', () => {
    it('should extract OUI correctly', () => {
      expect(ouiOf('00:11:22:33:44:55')).toBe('00:11:22');
      expect(ouiOf('AA:BB:CC:DD:EE:FF')).toBe('AA:BB:CC');
    });

    it('should return null for malformed BSSID', () => {
      expect(ouiOf('invalid')).toBe(null);
      expect(ouiOf('00:11')).toBe(null);
    });
  });

  describe('bandOf', () => {
    it('should return correct band for frequency', () => {
      expect(bandOf(2412)).toBe(2);
      expect(bandOf(5180)).toBe(5);
      expect(bandOf(6000)).toBe(6);
      expect(bandOf(1000)).toBe(0);
    });
  });

  describe('isOpenSecurity', () => {
    it('should return true for open security strings', () => {
      expect(isOpenSecurity('')).toBe(true);
      expect(isOpenSecurity('OPEN')).toBe(true);
      expect(isOpenSecurity('NONE')).toBe(true);
    });

    it('should return false for secured security strings', () => {
      expect(isOpenSecurity('WPA2-PSK')).toBe(false);
      expect(isOpenSecurity('WEP')).toBe(false);
      expect(isOpenSecurity('WPA3-SAE')).toBe(false);
    });
  });
});
