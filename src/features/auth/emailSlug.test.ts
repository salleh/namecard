import { describe, expect, it } from "vitest";
import { deriveEmailSlug } from "./emailSlug";

describe("deriveEmailSlug", () => {
  it("derives the lowercased local part of mail", () => {
    expect(deriveEmailSlug({ mail: "Jane.Tan@example.com", userPrincipalName: null })).toBe(
      "jane.tan",
    );
  });

  it("falls back to userPrincipalName when mail is absent", () => {
    expect(deriveEmailSlug({ mail: undefined, userPrincipalName: "ahmad.z@example.com" })).toBe(
      "ahmad.z",
    );
  });

  it("falls back to userPrincipalName when mail is null", () => {
    expect(deriveEmailSlug({ mail: null, userPrincipalName: "ahmad.z@example.com" })).toBe(
      "ahmad.z",
    );
  });

  it("prefers mail over userPrincipalName when both are present", () => {
    expect(
      deriveEmailSlug({
        mail: "jane.tan@example.com",
        userPrincipalName: "jtan@example.onmicrosoft.com",
      }),
    ).toBe("jane.tan");
  });

  it("returns null when both mail and userPrincipalName are absent", () => {
    expect(deriveEmailSlug({ mail: undefined, userPrincipalName: undefined })).toBeNull();
  });

  it("returns null when both mail and userPrincipalName are null", () => {
    expect(deriveEmailSlug({ mail: null, userPrincipalName: null })).toBeNull();
  });

  it("returns null when the address has no @", () => {
    expect(deriveEmailSlug({ mail: "not-an-email", userPrincipalName: null })).toBeNull();
  });

  it("returns null when the local part is empty", () => {
    expect(deriveEmailSlug({ mail: "@example.com", userPrincipalName: null })).toBeNull();
  });

  it("returns null when the derived slug collides with a reserved route", () => {
    expect(deriveEmailSlug({ mail: "admin@example.com", userPrincipalName: null })).toBeNull();
  });

  it("returns null when the local part exceeds the max slug length", () => {
    const longLocal = "a".repeat(65);
    expect(
      deriveEmailSlug({ mail: `${longLocal}@example.com`, userPrincipalName: null }),
    ).toBeNull();
  });
});
