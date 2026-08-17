import { describe, expect, it } from "vitest";
import { parseSlug } from "./slug";

describe("parseSlug", () => {
  it("accepts and lowercases a normal email local part", () => {
    expect(parseSlug("Jane.Tan")).toBe("jane.tan");
    expect(parseSlug("ahmad_zulkifli")).toBe("ahmad_zulkifli");
    expect(parseSlug("a")).toBe("a");
    expect(parseSlug("first-last+tag")).toBe("first-last+tag");
  });

  it("trims surrounding whitespace", () => {
    expect(parseSlug("  jane.tan  ")).toBe("jane.tan");
  });

  it("rejects empty or over-long slugs", () => {
    expect(parseSlug("")).toBeNull();
    expect(parseSlug("   ")).toBeNull();
    expect(parseSlug("a".repeat(65))).toBeNull();
  });

  it("rejects leading/trailing punctuation and unsafe characters", () => {
    expect(parseSlug(".jane")).toBeNull();
    expect(parseSlug("jane.")).toBeNull();
    expect(parseSlug("jane/tan")).toBeNull();
    expect(parseSlug("jane tan")).toBeNull();
    expect(parseSlug("../etc/passwd")).toBeNull();
    expect(parseSlug("jane%0d%0a")).toBeNull();
    expect(parseSlug("jane@example.com")).toBeNull();
  });

  it("rejects reserved slugs that collide with static routes", () => {
    expect(parseSlug("me")).toBeNull();
    expect(parseSlug("admin")).toBeNull();
    expect(parseSlug("API")).toBeNull();
    expect(parseSlug("vcf")).toBeNull();
    expect(parseSlug("avatar")).toBeNull();
  });
});
