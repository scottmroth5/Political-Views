import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against a real, disposable Postgres database.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://political_views:local_dev_password@localhost:5433/political_views_test?schema=public";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: "test" },
    // Tests share one database; run files sequentially.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
