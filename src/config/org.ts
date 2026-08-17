import { orgConfig as rawOrgConfig } from "../../customization/org";
import { orgConfigSchema, type OrgConfig } from "./orgSchema";

// Validates the deployment's customization file (customization/org.ts) once at
// module load, so a typo there fails fast with a readable message instead of
// surfacing as broken UI copy or an invalid manifest. Safe to import from
// client components — org config is public branding, never secrets.
export function parseOrgConfig(source: unknown): OrgConfig {
  const result = orgConfigSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid customization/org.ts:\n${issues}`);
  }
  return result.data;
}

export const org: OrgConfig = parseOrgConfig(rawOrgConfig);
