import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const run = process.env.OFFLINE_BROWSER_MATRIX ? 'browsers' : 'chromium';

export default defineConfig({
  testDir: './tests/offline',
  testMatch: '**/*.spec.ts',
  outputDir: `./.offline/${run}-results`,
  timeout: 60_000,
  workers: 1,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `.offline/${run}-results.json`,
      },
    ],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(existsSync('/opt/google/chrome/chrome')
      ? [{ name: 'chrome', use: { browserName: 'chromium' as const, channel: 'chrome' } }]
      : []),
    ...(existsSync('/opt/microsoft/msedge/msedge')
      ? [{ name: 'msedge', use: { browserName: 'chromium' as const, channel: 'msedge' } }]
      : []),
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    baseURL: process.env.OFFLINE_PREVIEW_URL || 'http://127.0.0.1:9165/v2/',
    headless: true,
    serviceWorkers: 'allow',
  },
  webServer: process.env.OFFLINE_PREVIEW_URL
    ? undefined
    : {
        command:
          'VITE_BASE_PATH=/v2 pnpm build && cp tests/offline/config.json dist/config.json && VITE_BASE_PATH=/v2 node scripts/preview-offline-tests.mjs',
        url: 'http://127.0.0.1:9165/v2/',
        timeout: 180_000,
        reuseExistingServer: false,
      },
});
