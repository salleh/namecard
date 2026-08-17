// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const VALID_DATABASE_URL = "postgresql://user:pass@localhost:5432/namecard";

// A fully valid source object — every test starts from this and overrides
// only the field under test, so tightening the schema further only requires
// editing this one object.
const VALID_ENV = {
  DATABASE_URL: VALID_DATABASE_URL,
  AUTH_SECRET: "dummy-auth-secret-for-tests-paddingg",
  AUTH_URL: "https://namecard.example.com",
  AUTH_MICROSOFT_ENTRA_APPLICATION_ID: "00000000-0000-0000-0000-000000000000",
  AUTH_MICROSOFT_ENTRA_ID_SECRET: "test-client-secret",
  AUTH_MICROSOFT_ENTRA_ID_ISSUER:
    "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0",
  ADMIN_GROUP_ID: "00000000-0000-0000-0000-000000000000",
};

function withoutField(key: keyof typeof VALID_ENV): Record<string, string> {
  const copy: Record<string, string> = { ...VALID_ENV };
  delete copy[key];
  return copy;
}

describe("parseEnv", () => {
  it("defaults NODE_ENV to development when absent", () => {
    expect(parseEnv(VALID_ENV).NODE_ENV).toBe("development");
  });

  it("accepts a valid AUTH_URL", () => {
    const parsed = parseEnv({ ...VALID_ENV, AUTH_URL: "https://namecard.example.com" });
    expect(parsed.AUTH_URL).toBe("https://namecard.example.com");
  });

  it("throws an aggregated error on an invalid AUTH_URL", () => {
    expect(() => parseEnv({ ...VALID_ENV, AUTH_URL: "not-a-url" })).toThrow(
      /Invalid environment variables/,
    );
  });

  it("labels a root-level validation error as (root)", () => {
    expect(() => parseEnv(null as unknown as Record<string, string | undefined>)).toThrow(
      /\(root\)/,
    );
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => parseEnv(withoutField("DATABASE_URL"))).toThrow(/DATABASE_URL/);
  });

  it("throws when DATABASE_URL is an empty string", () => {
    expect(() => parseEnv({ ...VALID_ENV, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("accepts a valid DATABASE_URL", () => {
    expect(parseEnv(VALID_ENV).DATABASE_URL).toBe(VALID_DATABASE_URL);
  });

  it("accepts a fully valid env", () => {
    expect(() => parseEnv(VALID_ENV)).not.toThrow();
  });

  it("throws when AUTH_SECRET is missing", () => {
    expect(() => parseEnv(withoutField("AUTH_SECRET"))).toThrow(/AUTH_SECRET/);
  });

  it("throws when AUTH_MICROSOFT_ENTRA_APPLICATION_ID is missing", () => {
    expect(() => parseEnv(withoutField("AUTH_MICROSOFT_ENTRA_APPLICATION_ID"))).toThrow(
      /AUTH_MICROSOFT_ENTRA_APPLICATION_ID/,
    );
  });

  it("throws when AUTH_MICROSOFT_ENTRA_ID_SECRET is missing", () => {
    expect(() => parseEnv(withoutField("AUTH_MICROSOFT_ENTRA_ID_SECRET"))).toThrow(
      /AUTH_MICROSOFT_ENTRA_ID_SECRET/,
    );
  });

  it("throws when AUTH_MICROSOFT_ENTRA_ID_ISSUER is not a valid URL", () => {
    expect(() => parseEnv({ ...VALID_ENV, AUTH_MICROSOFT_ENTRA_ID_ISSUER: "not-a-url" })).toThrow(
      /AUTH_MICROSOFT_ENTRA_ID_ISSUER/,
    );
  });

  it("throws when ADMIN_GROUP_ID is missing", () => {
    expect(() => parseEnv(withoutField("ADMIN_GROUP_ID"))).toThrow(/ADMIN_GROUP_ID/);
  });

  it("rejects a multi-tenant 'common' issuer (CLAUDE.md: never common)", () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/common/v2.0",
      }),
    ).toThrow(/tenant-specific/);
  });

  it("rejects an 'organizations' issuer", () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/organizations/v2.0",
      }),
    ).toThrow(/tenant-specific/);
  });

  it("rejects a 'consumers' issuer", () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/consumers/v2.0",
      }),
    ).toThrow(/tenant-specific/);
  });

  it("accepts a tenant-specific GUID issuer", () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        AUTH_MICROSOFT_ENTRA_ID_ISSUER:
          "https://login.microsoftonline.com/a4ad4f07-b070-49b9-ae3f-1cfd05e4dee2/v2.0",
      }),
    ).not.toThrow();
  });

  it("rejects an AUTH_SECRET shorter than 32 characters", () => {
    expect(() => parseEnv({ ...VALID_ENV, AUTH_SECRET: "too-short" })).toThrow(/AUTH_SECRET/);
  });

  it("accepts an AUTH_SECRET of exactly 32 characters", () => {
    expect(() => parseEnv({ ...VALID_ENV, AUTH_SECRET: "a".repeat(32) })).not.toThrow();
  });

  it("rejects a non-GUID AUTH_MICROSOFT_ENTRA_APPLICATION_ID", () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, AUTH_MICROSOFT_ENTRA_APPLICATION_ID: "not-a-guid" }),
    ).toThrow(/AUTH_MICROSOFT_ENTRA_APPLICATION_ID/);
  });

  it("rejects a non-GUID ADMIN_GROUP_ID", () => {
    expect(() => parseEnv({ ...VALID_ENV, ADMIN_GROUP_ID: "not-a-guid" })).toThrow(
      /ADMIN_GROUP_ID/,
    );
  });
});
