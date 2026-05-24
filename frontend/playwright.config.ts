import { defineConfig, devices } from '@playwright/test'

// When E2E_BASE_URL is set (pointing at a running Docker Compose stack),
// Playwright skips the built-in preview server and runs against the live stack.
const liveStack = !!process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 780 },
      },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Runs both snapshot tests and critical-path e2e tests
      testIgnore: /mobile\.spec\.ts/,
    },
  ],
  // webServer: start `bun run preview` for snapshot tests against the static build.
  // Skipped when E2E_BASE_URL is set (full Docker stack is already running).
  webServer: liveStack || process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: 'bun run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
})
