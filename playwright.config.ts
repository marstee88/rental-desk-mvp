import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5179/rental-desk-mvp/', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5179 --strictPort',
    url: 'http://127.0.0.1:5179/rental-desk-mvp/',
    env: { VITE_SUPABASE_URL: 'https://cloud-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key' },
    reuseExistingServer: false,
  },
})
