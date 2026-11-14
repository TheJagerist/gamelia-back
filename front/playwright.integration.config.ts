import { defineConfig, devices } from '@playwright/test';

// Tests d'intégration : le front en mode API réelle, branché sur le back et PostgreSQL.
// Prérequis (voir README) : back lancé avec `npm run seed:demo`, front construit avec
// l'adresse de l'API (sans NEXT_PUBLIC_API_MOCK), puis : npm run test:integration
export default defineConfig({
  testDir: './tests-integration',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.INTEGRATION_URL || 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'ordinateur', use: { ...devices['Desktop Chrome'] } }],
});
