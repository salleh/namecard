import { describe, expect, it } from "vitest";
import { MAX_SEARCH_LENGTH, normalizeAdminSearch } from "./adminSearch";

describe("normalizeAdminSearch", () => {
  it("returns an empty string for null/undefined/blank input", () => {
    expect(normalizeAdminSearch(null)).toBe("");
    expect(normalizeAdminSearch(undefined)).toBe("");
    expect(normalizeAdminSearch("   ")).toBe("");
  });

  it("trims and lowercases the query", () => {
    expect(normalizeAdminSearch("  Jane TAN  ")).toBe("jane tan");
  });

  it("strips control characters", () => {
    expect(normalizeAdminSearch("jane\r\ntan")).toBe("janetan");
  });

  it("caps the query length", () => {
    const long = "a".repeat(MAX_SEARCH_LENGTH + 50);

    expect(normalizeAdminSearch(long)).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("preserves interior single spaces and common name punctuation", () => {
    expect(normalizeAdminSearch("ahmad.zulkifli")).toBe("ahmad.zulkifli");
  });
});
