// Module augmentation for Auth.js v5 (src/auth.ts). Adds the StaffCard-derived
// session claims the app reads elsewhere: `emailSlug`/`entraObjectId` link a
// session back to the owner's own StaffCard (Step 6 `/me`), and `isAdmin` is
// the Approach A group-claim gate (Step 7 admin console).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      entraObjectId?: string;
      emailSlug?: string;
      isAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    entraObjectId?: string;
    emailSlug?: string;
    isAdmin?: boolean;
  }
}
