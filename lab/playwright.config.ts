import { defineConfig, devices } from "@playwright/test";

const port = 3200;
const e2eDb = process.env.E2E_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pedlab_e2e";

/**
 * Сквозные тесты запускаются на production-сборке (npm run build) с отдельной базой,
 * которая пересоздаётся и наполняется демо-данными перед запуском.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", locale: "ru-RU" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${port}`,
    port,
    reuseExistingServer: false,
    env: { DATABASE_URL: e2eDb, UPLOAD_DIR: "./storage/e2e-uploads", APP_URL: `http://localhost:${port}` },
  },
});
