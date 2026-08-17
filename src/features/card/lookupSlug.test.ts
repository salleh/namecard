import { describe, expect, it } from "vitest";
import { slugFromLookup } from "./lookupSlug";

describe("slugFromLookup", () => {
  it("returns a bare local part unchanged", () => {
    expect(slugFromLookup("jane.tan")).toBe("jane.tan");
  });

  it("lowercases and trims input", () => {
    expect(slugFromLookup("  Jane.Tan  ")).toBe("jane.tan");
  });

  it("strips a full staff email down to the local part", () => {
    expect(slugFromLookup("jane.tan@example.com")).toBe("jane.tan");
  });

  it("strips the domain case-insensitively", () => {
    expect(slugFromLookup("Jane.Tan@EXAMPLE.COM")).toBe("jane.tan");
  });

  it("accepts the local part regardless of which domain was typed", () => {
    // The page itself 404s for non-staff; the parser only shapes the slug.
    expect(slugFromLookup("jane.tan@example.com")).toBe("jane.tan");
  });

  it("returns null for an empty or whitespace-only input", () => {
    expect(slugFromLookup("")).toBeNull();
    expect(slugFromLookup("   ")).toBeNull();
  });

  it("returns null when the local part is empty", () => {
    expect(slugFromLookup("@example.com")).toBeNull();
  });

  it("returns null for inputs with invalid slug characters", () => {
    expect(slugFromLookup("jane tan")).toBeNull();
    expect(slugFromLookup("jane/tan")).toBeNull();
  });

  it("returns null for reserved route names", () => {
    expect(slugFromLookup("admin")).toBeNull();
    expect(slugFromLookup("me")).toBeNull();
  });
});
