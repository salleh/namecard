import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { adminActorFrom, isAdminSession } from "./adminAccess";

function sessionWith(user: Partial<Session["user"]>): Session {
  return { user: { isAdmin: false, ...user }, expires: "2099-01-01T00:00:00.000Z" } as Session;
}

describe("isAdminSession", () => {
  it("is false for a null/undefined session", () => {
    expect(isAdminSession(null)).toBe(false);
    expect(isAdminSession(undefined)).toBe(false);
  });

  it("is false when isAdmin is not exactly true", () => {
    expect(isAdminSession(sessionWith({ isAdmin: false }))).toBe(false);
  });

  it("is true only when the isAdmin claim is true", () => {
    expect(isAdminSession(sessionWith({ isAdmin: true }))).toBe(true);
  });
});

describe("adminActorFrom", () => {
  it("returns null for a non-admin session", () => {
    expect(
      adminActorFrom(sessionWith({ isAdmin: false, entraObjectId: "o", emailSlug: "s" })),
    ).toBeNull();
  });

  it("returns null for an admin missing the ids needed to attribute an action", () => {
    expect(adminActorFrom(sessionWith({ isAdmin: true }))).toBeNull();
  });

  it("returns the actor for a complete admin session", () => {
    const actor = adminActorFrom(
      sessionWith({
        isAdmin: true,
        entraObjectId: "oid-admin",
        emailSlug: "admin.user",
        email: "admin.user@example.com",
      }),
    );

    expect(actor).toEqual({
      entraObjectId: "oid-admin",
      emailSlug: "admin.user",
      email: "admin.user@example.com",
    });
  });

  it("defaults a missing email to null", () => {
    const actor = adminActorFrom(
      sessionWith({ isAdmin: true, entraObjectId: "oid-admin", emailSlug: "admin.user" }),
    );

    expect(actor?.email).toBeNull();
  });
});
