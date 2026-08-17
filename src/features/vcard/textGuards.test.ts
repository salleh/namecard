import { describe, expect, it } from "vitest";
import { isBlank } from "./textGuards";

describe("isBlank", () => {
  it("treats null and undefined as blank", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });

  it("treats empty and whitespace-only strings as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\t\n")).toBe(true);
  });

  it("treats strings with non-whitespace content as not blank", () => {
    expect(isBlank("x")).toBe(false);
    expect(isBlank("  padded  ")).toBe(false);
  });
});
