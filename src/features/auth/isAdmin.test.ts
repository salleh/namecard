import { describe, expect, it } from "vitest";
import { computeIsAdmin } from "./isAdmin";

describe("computeIsAdmin", () => {
  it("returns true when adminGroupId is present in groups", () => {
    expect(computeIsAdmin(["group-a", "admin-group"], "admin-group")).toBe(true);
  });

  it("returns false when adminGroupId is absent from groups", () => {
    expect(computeIsAdmin(["group-a", "group-b"], "admin-group")).toBe(false);
  });

  it("returns false when groups is empty", () => {
    expect(computeIsAdmin([], "admin-group")).toBe(false);
  });

  it("returns false when adminGroupId is undefined (env not configured)", () => {
    expect(computeIsAdmin(["group-a"], undefined)).toBe(false);
  });

  it("returns false when adminGroupId is an empty string", () => {
    expect(computeIsAdmin(["group-a", ""], "")).toBe(false);
  });
});
