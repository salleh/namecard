import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminActor } from "./adminAccess";
import { formatAdminAudit, logAdminAudit } from "./audit";

const ACTOR: AdminActor = {
  entraObjectId: "oid-admin",
  emailSlug: "admin.user",
  email: "admin.user@example.com",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatAdminAudit", () => {
  it("renders a card-status change with actor and target (no secrets)", () => {
    const line = formatAdminAudit({
      type: "card_disabled_changed",
      actor: ACTOR,
      targetSlug: "ahmad.zulkifli",
      disabled: true,
    });

    expect(line).toContain("ADMIN_AUDIT");
    expect(line).toContain("card_disabled_changed");
    expect(line).toContain("actor=admin.user");
    expect(line).toContain("target=ahmad.zulkifli");
    expect(line).toContain("disabled=true");
  });

  it("renders a field-policy change as a full snapshot of the locked set", () => {
    const line = formatAdminAudit({
      type: "field_policy_changed",
      actor: ACTOR,
      locked: ["jobTitle", "department"],
    });

    expect(line).toContain("ADMIN_AUDIT");
    expect(line).toContain("field_policy_changed");
    expect(line).toContain("actor=admin.user");
    expect(line).toContain("locked=jobTitle,department");
  });

  it("renders an all-unlocked policy as locked=<none>", () => {
    const line = formatAdminAudit({ type: "field_policy_changed", actor: ACTOR, locked: [] });

    expect(line).toContain("field_policy_changed");
    expect(line).toContain("locked=<none>");
  });

  it("renders an admin card edit with actor and target", () => {
    const line = formatAdminAudit({
      type: "admin_card_edited",
      actor: ACTOR,
      targetSlug: "ahmad.zulkifli",
    });

    expect(line).toContain("admin_card_edited");
    expect(line).toContain("actor=admin.user");
    expect(line).toContain("target=ahmad.zulkifli");
  });

  it("renders an admin M365 fetch with actor and target", () => {
    const line = formatAdminAudit({
      type: "admin_m365_fetch",
      actor: ACTOR,
      targetSlug: "ahmad.zulkifli",
    });

    expect(line).toContain("admin_m365_fetch");
    expect(line).toContain("actor=admin.user");
    expect(line).toContain("target=ahmad.zulkifli");
  });

  it("renders a denied-access attempt with the attempted identity and path", () => {
    const line = formatAdminAudit({
      type: "access_denied",
      email: "mallory@example.com",
      path: "/admin",
    });

    expect(line).toContain("ADMIN_AUDIT");
    expect(line).toContain("access_denied");
    expect(line).toContain("mallory@example.com");
    expect(line).toContain("/admin");
  });

  it("strips control characters from the logged email (log-injection defense)", () => {
    const line = formatAdminAudit({
      type: "access_denied",
      email: "mallory@x\r\nADMIN_AUDIT type=card_disabled_changed",
      path: "/admin",
    });

    expect(line).not.toContain("\r");
    expect(line).not.toContain("\n");
  });

  it("tolerates a null email on a denied attempt", () => {
    const line = formatAdminAudit({ type: "access_denied", email: null, path: "/admin" });

    expect(line).toContain("access_denied");
    expect(line).toContain("email=anonymous");
  });
});

describe("logAdminAudit", () => {
  it("writes the formatted line to the server log exactly once", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAdminAudit({
      type: "card_disabled_changed",
      actor: ACTOR,
      targetSlug: "ahmad.zulkifli",
      disabled: false,
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("ADMIN_AUDIT"));
  });
});
