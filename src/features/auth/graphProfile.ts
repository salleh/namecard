import { z } from "zod";

// Shape of the Microsoft Graph `GET /v1.0/me` response, restricted to the
// fields the app actually requests via `$select` (CLAUDE.md "Authentication
// & Data Flow"). All profile fields are optional/nullable — Graph omits or
// nulls fields the tenant hasn't populated; `id` is the only field the app
// depends on unconditionally (it is the stable Entra object id / row key).
export const graphMeResponseSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().nullable().optional(),
  givenName: z.string().nullable().optional(),
  surname: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
  userPrincipalName: z.string().nullable().optional(),
  businessPhones: z.array(z.string()).nullable().optional(),
  mobilePhone: z.string().nullable().optional(),
  faxNumber: z.string().nullable().optional(),
  officeLocation: z.string().nullable().optional(),
  // Structured postal address components — collapsed into the single `address`
  // string on first login (see `composeAddress`).
  streetAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export type GraphMeResponse = z.infer<typeof graphMeResponseSchema>;

// The StaffCard vCard fields that are safe to derive from a Graph /me
// snapshot. `address` is composed from Graph's structured components; `website`
// stays excluded (no Graph source — company-default + per-staff override,
// Step 6), and photo is handled separately as bytes.
export interface StaffCardVCardFields {
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  email: string | null;
  businessPhone: string | null;
  mobilePhone: string | null;
  faxNumber: string | null;
  officeLocation: string | null;
  address: string | null;
}

// Collapses Graph's structured postal fields into one free-text `address`
// string (CLAUDE.md keeps `address` as a single staff-editable field). Blank
// components are dropped; the rest are joined "street, city, state, postal,
// country". Returns null when Graph supplied no address at all.
function composeAddress(profile: GraphMeResponse): string | null {
  const parts = [
    profile.streetAddress,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && part.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

// Maps Graph's `businessPhones` (an array — Entra allows multiple numbers) to
// the single `businessPhone` column: the first entry wins, per CLAUDE.md's
// data model (one businessPhone field). `email` prefers `mail`, falling back
// to `userPrincipalName` for accounts where `mail` is unset (e.g. some
// service/guest accounts) — mirrors the fallback used for slug derivation.
export function mapGraphProfileToVCardFields(profile: GraphMeResponse): StaffCardVCardFields {
  return {
    displayName: profile.displayName ?? null,
    givenName: profile.givenName ?? null,
    surname: profile.surname ?? null,
    jobTitle: profile.jobTitle ?? null,
    department: profile.department ?? null,
    company: profile.companyName ?? null,
    email: profile.mail ?? profile.userPrincipalName ?? null,
    businessPhone: profile.businessPhones?.[0] ?? null,
    mobilePhone: profile.mobilePhone ?? null,
    faxNumber: profile.faxNumber ?? null,
    officeLocation: profile.officeLocation ?? null,
    address: composeAddress(profile),
  };
}
