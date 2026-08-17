import { org } from "./org";

// Company-wide vCard defaults, derived from the deployment's customization
// file (customization/org.ts). A blank staff field falls back to these; a
// non-blank staff value always wins (see features/vcard/companyDefaults.ts).
export interface CompanyDefaults {
  company: string;
  website: string;
  address: string;
}

export const COMPANY_DEFAULTS: CompanyDefaults = {
  company: org.orgLegalName,
  website: org.website,
  address: org.address,
};
