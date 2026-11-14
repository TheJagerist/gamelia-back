import { defineConfig, devices } from '@playwright/test';

// Tests des parcours clés (cahier des charges, section 11). Lancer : npm run build && npm test
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3300', trace: 'retain-on-failure' },
  projects: [
    { name: 'telephone', use: { ...devices['Pixel 5'] } },
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: 'npx next start -p 3300', url: 'http://localhost:3300', reuseExistingServer: true, timeout: 60_000 },
});
