const defaultConfig = require('./jest.config');

module.exports = {
  ...defaultConfig,
  collectCoverage: true,
  testTimeout: 20000,
};
