module.exports = {
  testEnvironment:     'node',
  testMatch:           ['**/tests/**/*.test.js'],
  globalSetup:         './tests/globalSetup.js',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout:         30000,
  collectCoverageFrom: ['src/**/*.js', '!src/docs/**'],
  coverageDirectory:   'coverage',
  coverageThreshold:   { global: { branches: 70, functions: 80, lines: 80 } },
  forceExit:           true,
  detectOpenHandles:   true,
};
