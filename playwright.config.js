import { defineConfig, devices } from '@playwright/test'

// Runs against the production build so tests see exactly what GitHub Pages serves.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4300' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4300 --strictPort',
    url: 'http://localhost:4300/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
