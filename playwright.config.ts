import { defineConfig, devices } from '@playwright/test';
import { getFrontendBaseUrl, loadEnv } from './e2e/helpers/env';

loadEnv();

const isHeaded = ['1', 'true', 'yes'].includes((process.env.PW_HEADED ?? '').toLowerCase());
const slowMo = Number(process.env.PW_SLOWMO ?? 0);
const launchOptions = Number.isFinite(slowMo) && slowMo > 0 ? { slowMo } : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: getFrontendBaseUrl(),
    headless: !isHeaded,
    ...(launchOptions ? { launchOptions } : {}),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
