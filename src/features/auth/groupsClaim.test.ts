import { describe, expect, it } from "vitest";
import { extractGroupsClaim } from "./groupsClaim";

describe("extractGroupsClaim", () => {
  it("returns the groups array when present and well-formed", () => {
    expect(extractGroupsClaim({ groups: ["group-a", "group-b"] })).toEqual(["group-a", "group-b"]);
  });

  it("returns an empty array when groups is absent (claim not configured yet)", () => {
    expect(extractGroupsClaim({ sub: "user-1" })).toEqual([]);
  });

  it("returns an empty array when profile is null", () => {
    expect(extractGroupsClaim(null)).toEqual([]);
  });

  it("returns an empty array when profile is undefined", () => {
    expect(extractGroupsClaim(undefined)).toEqual([]);
  });

  it("returns an empty array when profile is not an object", () => {
    expect(extractGroupsClaim("not-an-object")).toEqual([]);
  });

  it("returns an empty array when groups is not an array", () => {
    expect(extractGroupsClaim({ groups: "not-an-array" })).toEqual([]);
  });

  it("filters out non-string entries", () => {
    expect(extractGroupsClaim({ groups: ["group-a", 123, null, "group-b"] })).toEqual([
      "group-a",
      "group-b",
    ]);
  });

  it("returns an empty array for an empty groups array", () => {
    expect(extractGroupsClaim({ groups: [] })).toEqual([]);
  });
});
