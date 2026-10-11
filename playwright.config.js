const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome', serviceWorkers: 'allow' },
  webServer: { command: 'node tests/serve.js', url: 'http://127.0.0.1:4173', reuseExistingServer: true }
});
