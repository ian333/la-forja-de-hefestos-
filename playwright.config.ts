import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — E2E verification of parametric parts in the UI.
 * Runs against the Vite dev server on port 5001 (started automatically).
 *
 * Headless Chromium uses SwiftShader for WebGL when no GPU is available
 * (CI, WSL2 without /dev/dri). Tests that only touch DOM are unaffected.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  workers: 1,

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5001',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  use: {
    baseURL: 'http://localhost:5001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-gl=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
