import { COMPANY_DEFAULTS } from "../../config/company";
import { isBlank } from "./textGuards";
import type { VCardInput } from "./types";

export interface ResolvedCompanyFields {
  address: string;
  website: string;
}

// Company-wide address/website defaults, individually overridable per staff
// (CLAUDE.md "Locked decisions" and implementation-plan.md Step 3). A blank
// staff value falls back to the company default; a non-blank staff value
// always wins. Pure function — never mutates `input`.
export function resolveCompanyDefaults(
  input: Pick<VCardInput, "address" | "website">,
): ResolvedCompanyFields {
  return {
    address: isBlank(input.address) ? COMPANY_DEFAULTS.address : input.address,
    website: isBlank(input.website) ? COMPANY_DEFAULTS.website : input.website,
  };
}
