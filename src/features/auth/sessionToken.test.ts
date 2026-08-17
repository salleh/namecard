import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";
import { buildSessionToken } from "./sessionToken";

const ADMIN_GROUP_ID = "admin-group-id";

describe("buildSessionToken", () => {
  describe("sign-in (profile present)", () => {
    it("sets isAdmin=true when the admin group is present in the groups claim", () => {
      const token: JWT = {};

      const result = buildSessionToken({
        token,
        profile: { groups: [ADMIN_GROUP_ID] },
        adminGroupId: ADMIN_GROUP_ID,
        staffCard: { entraObjectId: "oid-1", emailSlug: "jane.tan" },
      });

      expect(result.isAdmin).toBe(true);
    });

    it("sets isAdmin=false when the caller is not a member of the admin group", () => {
      const token: JWT = {};

      const result = buildSessionToken({
        token,
        profile: { groups: ["some-other-group"] },
        adminGroupId: ADMIN_GROUP_ID,
        staffCard: { entraObjectId: "oid-1", emailSlug: "jane.tan" },
      });

      expect(result.isAdmin).toBe(false);
    });

    it("sets isAdmin=false when the groups claim is absent (claim not configured yet)", () => {
      const token: JWT = {};

      const result = buildSessionToken({
        token,
        profile: { sub: "user-1" },
        adminGroupId: ADMIN_GROUP_ID,
      });

      expect(result.isAdmin).toBe(false);
    });

    it("adopts entraObjectId/emailSlug from a successful staffCard upsert", () => {
      const token: JWT = {};

      const result = buildSessionToken({
        token,
        profile: { groups: [] },
        adminGroupId: ADMIN_GROUP_ID,
        staffCard: { entraObjectId: "oid-1", emailSlug: "jane.tan" },
      });

      expect(result.entraObjectId).toBe("oid-1");
      expect(result.emailSlug).toBe("jane.tan");
    });

    it("falls back to the existing token's entraObjectId/emailSlug when the upsert failed (no staffCard)", () => {
      const token: JWT = { entraObjectId: "oid-old", emailSlug: "old.slug" };

      const result = buildSessionToken({
        token,
        profile: { groups: [] },
        adminGroupId: ADMIN_GROUP_ID,
        staffCard: undefined,
      });

      expect(result.entraObjectId).toBe("oid-old");
      expect(result.emailSlug).toBe("old.slug");
    });

    it("recomputes isAdmin even when a previous token already carried isAdmin=true (revocation case)", () => {
      const token: JWT = { isAdmin: true };

      const result = buildSessionToken({
        token,
        profile: { groups: [] }, // no longer a member
        adminGroupId: ADMIN_GROUP_ID,
      });

      expect(result.isAdmin).toBe(false);
    });
  });

  describe("session refresh (profile absent) — the H-1 regression guard", () => {
    it("preserves isAdmin=true from the existing token instead of resetting it", () => {
      const token: JWT = { isAdmin: true, entraObjectId: "oid-1", emailSlug: "jane.tan" };

      const result = buildSessionToken({
        token,
        profile: undefined,
        adminGroupId: ADMIN_GROUP_ID,
      });

      expect(result.isAdmin).toBe(true);
      expect(result.entraObjectId).toBe("oid-1");
      expect(result.emailSlug).toBe("jane.tan");
    });

    it("preserves isAdmin=false unchanged", () => {
      const token: JWT = { isAdmin: false, entraObjectId: "oid-1", emailSlug: "jane.tan" };

      const result = buildSessionToken({
        token,
        profile: undefined,
        adminGroupId: ADMIN_GROUP_ID,
      });

      expect(result.isAdmin).toBe(false);
    });

    it("returns the token unchanged even if a (mistakenly passed) staffCard is provided", () => {
      const token: JWT = { isAdmin: true, entraObjectId: "oid-1", emailSlug: "jane.tan" };

      const result = buildSessionToken({
        token,
        profile: undefined,
        adminGroupId: ADMIN_GROUP_ID,
        staffCard: { entraObjectId: "oid-should-be-ignored", emailSlug: "ignored" },
      });

      expect(result).toEqual(token);
    });

    it("is a no-op regardless of adminGroupId", () => {
      const token: JWT = { isAdmin: true };

      const result = buildSessionToken({ token, profile: undefined, adminGroupId: undefined });

      expect(result.isAdmin).toBe(true);
    });
  });
});
