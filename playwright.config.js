import { defineConfig, devices } from '@playwright/test'

// Local Chrome for Testing (playwright's CDN download is flaky here;
// the binary was fetched directly from storage.googleapis.com).
// Only override the browser binary when the env var is set: on CI the
// workflow installs Playwright's managed Chromium and the config must
// NOT point at this VM's local path (that broke the first Actions run:
// executable doesn't exist on the runner).
// Local runs: export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/hatch/workspace/.chrome-for-test/chrome-linux64/chrome
const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {})
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Chromium-based mobile emulation (iPhone 13 device preset defaults to
    // WebKit, which is not installed here; Pixel preset runs on Chromium).
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ]
})
