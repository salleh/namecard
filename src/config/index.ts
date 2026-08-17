// Server-side barrel: `env` is server-only (env.ts throws if imported in the
// browser). Client components needing branding must import "@/config/org"
// directly instead of this barrel.
export { env, parseEnv, type Env } from "./env";
export { COMPANY_DEFAULTS, type CompanyDefaults } from "./company";
export { org, parseOrgConfig } from "./org";
export { orgConfigSchema, type OrgConfig, type OrgConfigInput } from "./orgSchema";
