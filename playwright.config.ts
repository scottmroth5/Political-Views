import { defineConfig, devices } from "@playwright/test";
import { hashAdminPassword } from "./src/domain/admin/admin-password";
import { E2E_ADMIN_PASSWORD } from "./tests/e2e/admin-credentials";

// End-to-end tests run the production build (`npm run build` first) against the disposable test
// database, which global setup migrates and seeds. Never point TEST_DATABASE_URL at real data.
const port = 3100;
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://political_views:local_dev_password@localhost:5433/political_views_test?schema=public";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/prepare-standalone.mjs && node .next/standalone/server.js",
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: testDatabaseUrl,
      REQUIRE_REVIEWED_QUESTIONS: "false",
      ANALYTICS_TOKEN: "",
      ADMIN_PASSWORD_HASH: hashAdminPassword(E2E_ADMIN_PASSWORD),
    },
  },
});
