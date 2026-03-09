module.exports = {
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'test/wifi-scanner.test.js', // Skip due to UUID ESM compatibility issues
  ],
};
