module.exports = {
  testEnvironment:     'node',
  testMatch:           ['**/tests/**/*.test.js'],
  globalSetup:         './tests/globalSetup.js',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout:         30000,
  collectCoverageFrom: ['src/**/*.js', '!src/docs/**'],
  coverageDirectory:   'coverage',
  coverageThreshold:   { global: { branches: 50, functions: 50, lines: 50 } },
  forceExit:           true,
  detectOpenHandles:   true,
};
