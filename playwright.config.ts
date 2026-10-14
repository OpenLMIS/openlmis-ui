import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/offline',
  outputDir: './.offline/test-results',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:9165/v2/',
    headless: true,
    serviceWorkers: 'allow',
  },
  webServer: {
    command:
      'VITE_BASE_PATH=/v2 pnpm build && cp tests/offline/config.json dist/config.json && VITE_BASE_PATH=/v2 pnpm preview --host 127.0.0.1 --port 9165 --strictPort',
    url: 'http://127.0.0.1:9165/v2/',
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
