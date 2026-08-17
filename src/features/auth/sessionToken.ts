import type { JWT } from "next-auth/jwt";
import { extractGroupsClaim } from "./groupsClaim";
import { computeIsAdmin } from "./isAdmin";

// The subset of the upserted StaffCard the JWT needs to carry — the fields
// /me (Step 6) and the admin console (Step 7) key off.
export interface StaffCardTokenFields {
  entraObjectId: string;
  emailSlug: string;
}

export interface BuildSessionTokenParams {
  // The token as it existed BEFORE this `jwt` callback invocation.
  token: JWT;
  // Present ONLY on the sign-in request itself — Auth.js omits `profile` on
  // every subsequent JWT refresh within the same session (e.g. reading an
  // existing session, token rotation). This is the sign-in/refresh
  // discriminator: undefined `profile` MUST mean "preserve everything",
  // never "recompute from nothing" (that was the H-1 regression — it reset
  // real admins to `isAdmin: false` on their very next session read).
  profile?: unknown;
  // Configured ADMIN_GROUP_ID — undefined means the admin gate can never
  // match (non-blocking; see docs/deploy/entra-app-registration.md §7).
  adminGroupId: string | undefined;
  // Result of the first-login Graph fetch + StaffCard upsert, already
  // performed by the caller (network + DB — deliberately kept out of this
  // function so it stays pure and unit-testable without mocking I/O).
  // `undefined` when this isn't a sign-in, or the upsert failed.
  staffCard?: StaffCardTokenFields;
}

// Pure merge of the next `jwt` callback token. Given the same inputs this
// always produces the same output, and performs no I/O — trivially
// unit-testable without mocking next-auth internals.
export function buildSessionToken({
  token,
  profile,
  adminGroupId,
  staffCard,
}: BuildSessionTokenParams): JWT {
  // No `profile` ⇒ a session refresh, not a sign-in. Every claim this
  // function owns (`isAdmin`, `entraObjectId`, `emailSlug`) must survive
  // completely untouched.
  if (profile === undefined) {
    return token;
  }

  const groups = extractGroupsClaim(profile);

  return {
    ...token,
    isAdmin: computeIsAdmin(groups, adminGroupId),
    entraObjectId: staffCard?.entraObjectId ?? token.entraObjectId,
    emailSlug: staffCard?.emailSlug ?? token.emailSlug,
  };
}
