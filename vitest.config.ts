import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration tests (real Postgres) run under vitest.integration.config.ts.
    exclude: ["e2e/**", "node_modules/**", "**/*.integration.test.ts"],
    // Dummy env so importing src/config/env.ts (eager parse on import) doesn't
    // throw in tests that don't touch the DB or auth — none of these are real
    // credentials (see .env.dev, git-ignored, for the actual dev Entra app).
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/namecard_test",
      AUTH_SECRET: "dummy-auth-secret-for-tests-paddingg",
      AUTH_URL: "http://localhost:3000",
      AUTH_MICROSOFT_ENTRA_APPLICATION_ID: "00000000-0000-0000-0000-000000000000",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "test-client-secret",
      AUTH_MICROSOFT_ENTRA_ID_ISSUER:
        "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0",
      ADMIN_GROUP_ID: "00000000-0000-0000-0000-000000000000",
    },
    coverage: {
      provider: "v8",
      include: ["src/config/**", "src/lib/**", "src/features/**"],
      // repository.ts and upsertStaffCard.ts are DB-bound and covered by the
      // integration suite instead. auth.ts wires next-auth itself (provider
      // config, NextAuth() init) — not pure logic, deliberately not unit
      // tested (see Step 5 handoff: "don't unit-test next-auth internals").
      exclude: [
        "src/features/card/repository.ts",
        "src/features/card/ownerRepository.ts",
        "src/features/card/fieldPolicyRepository.ts",
        "src/features/admin/adminRepository.ts",
        "src/features/auth/upsertStaffCard.ts",
        // Thin env-bound wiring over the (fully covered) app-only token factory,
        // analogous to auth.ts — imports @/config/env, no branching logic.
        "src/features/auth/graphAppToken.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
