module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['index.js'],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['./__tests__/setup.js'],
  testTimeout: 30000,
  verbose: true,
};
