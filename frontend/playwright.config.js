import { defineConfig } from '@playwright/test';
import process from 'node:process';

const e2eConfigured = Boolean(
  process.env.E2E_TEST_EMAIL
  && process.env.E2E_TEST_PASSWORD
  && process.env.VITE_SUPABASE_URL
  && process.env.VITE_SUPABASE_KEY
  && process.env.VITE_API_URL,
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_TEST_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  ...(e2eConfigured ? {
    webServer: {
      command: 'npm run dev -- --host 127.0.0.1',
      url: process.env.E2E_TEST_BASE_URL || 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_KEY: process.env.VITE_SUPABASE_KEY,
        VITE_API_URL: process.env.VITE_API_URL,
      },
    },
  } : {}),
});
