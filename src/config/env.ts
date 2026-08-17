import { z } from "zod";

// Entra object ids (application id, group id, tenant id) are GUIDs —
// catches copy/paste mistakes (extra whitespace, wrong field) early rather
// than at the first failed OIDC round-trip.
const GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// CLAUDE.md ("Deployment Topology" / entra-app-registration.md §10):
// "Single-tenant only... never common/organizations". Reject any issuer
// whose path uses one of Microsoft's multi-tenant/consumer aliases instead
// of an actual tenant GUID.
const MULTI_TENANT_ISSUER_SEGMENTS = ["/common/", "/organizations/", "/consumers/"];

function isTenantSpecificIssuer(issuer: string): boolean {
  return !MULTI_TENANT_ISSUER_SEGMENTS.some((segment) => issuer.includes(segment));
}

// Step 1: nothing is required to boot. Tightened incrementally: DATABASE_URL
// in Step 2, AUTH_* / ADMIN_GROUP_ID in Step 5 (Auth.js Entra OIDC wiring
// needs every one of these to construct the provider — see src/auth.ts).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Required non-empty Postgres connection string (Step 2).
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Required Entra OIDC credentials (Step 5). AUTH_SECRET signs/encrypts the
  // JWT session cookie (min length matches Auth.js's own recommendation —
  // short secrets are brute-forceable); AUTH_URL is the public origin OIDC
  // redirects and Secure cookies are generated for (CLAUDE.md "Deployment
  // Topology" — TLS terminates upstream at the DMZ nginx/Caddy).
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
  // Project-specific name (not Auth.js's auto-inferred AUTH_MICROSOFT_ENTRA_ID_ID)
  // — see docs/deploy/entra-app-registration.md §9 "Auth.js naming note".
  AUTH_MICROSOFT_ENTRA_APPLICATION_ID: z
    .string()
    .regex(GUID_PATTERN, "AUTH_MICROSOFT_ENTRA_APPLICATION_ID must be a GUID"),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1, "AUTH_MICROSOFT_ENTRA_ID_SECRET is required"),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z
    .string()
    .url("AUTH_MICROSOFT_ENTRA_ID_ISSUER must be a valid URL")
    .refine(
      isTenantSpecificIssuer,
      "AUTH_MICROSOFT_ENTRA_ID_ISSUER must be tenant-specific — 'common'/'organizations'/'consumers' are not allowed",
    ),

  // Required M365 admin security-group object id (Step 5 computes isAdmin
  // from it; Step 7 gates the admin console on it).
  ADMIN_GROUP_ID: z.string().regex(GUID_PATTERN, "ADMIN_GROUP_ID must be a GUID"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

// Defensive server-only guard (do NOT import "server-only" — it breaks Vitest/jsdom).
// Behavior is proven in env.browser.test.ts; excluded from coverage as it cannot
// execute during server-side unit tests.
/* v8 ignore next 3 */
if (typeof window !== "undefined") {
  throw new Error("env.ts must not be imported in client code.");
}

export const env = parseEnv();
