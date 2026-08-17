import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts (jsdom unit tests) on purpose: these tests
// hit a real Postgres database (`namecard_test`, see .env.test.example) and
// must never share a test run — or a coverage report — with the pure-jsdom
// unit suite.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Integration tests share one Postgres connection pool sequentially to
    // avoid cross-test row interference from concurrent file workers.
    fileParallelism: false,
  },
});
