import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real web app and API against a MOCK Gnani server (e2e/mock-gnani.mjs),
 * so no real API credits are used. Requires MongoDB at E2E_MONGODB_URI (default localhost).
 */
const MONGO = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mandimitra-e2e';
const chrome = process.env.PW_CHROME_PATH ? { launchOptions: { executablePath: process.env.PW_CHROME_PATH } } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...chrome,
        permissions: ['microphone'],
        launchOptions: {
          ...(chrome.launchOptions ?? {}),
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
        },
      },
    },
  ],
  webServer: [
    { command: 'node e2e/mock-gnani.mjs', url: 'http://localhost:4999/health', reuseExistingServer: !process.env.CI },
    {
      command: 'npm run dev -w @mandimitra/api',
      cwd: '../..',
      url: 'http://localhost:4001/api/health',
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test', PORT: '4001', MONGODB_URI: MONGO, CORS_ORIGINS: 'http://localhost:5174',
        JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret', GNANI_API_KEY: 'e2e-mock-key',
        GNANI_BASE_URL: 'http://localhost:4999', DEMO_MODE_ENABLED: 'true',
      },
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      env: { VITE_DEV_API_PROXY: 'http://localhost:4001' },
    },
  ],
});
