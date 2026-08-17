import { describe, expect, it } from "vitest";
import { orgConfig } from "../../customization/org";
import { org, parseOrgConfig } from "./org";

const VALID_CONFIG = {
  appName: "e-Namecard",
  appShortName: "e-Namecard",
  appDescription: "Staff electronic namecard with vCard QR.",
  orgName: "Example Organization",
  orgLegalName: "Example Organization Inc.",
  emailDomain: "example.com",
  website: "https://www.example.com",
  address: "1 Example Street",
  themeColor: "#f26522",
  backgroundColor: "#ffffff",
  logoAlt: "Example Organization",
};

describe("parseOrgConfig", () => {
  it("accepts a valid config", () => {
    expect(parseOrgConfig(VALID_CONFIG)).toEqual(VALID_CONFIG);
  });

  it("rejects a missing appName with a readable error", () => {
    expect(() => parseOrgConfig({ ...VALID_CONFIG, appName: "" })).toThrow(
      /customization\/org\.ts[\s\S]*appName/,
    );
  });

  it("rejects an emailDomain that is not a bare domain", () => {
    expect(() => parseOrgConfig({ ...VALID_CONFIG, emailDomain: "not a domain" })).toThrow(
      /emailDomain/,
    );
    expect(() => parseOrgConfig({ ...VALID_CONFIG, emailDomain: "user@example.com" })).toThrow(
      /emailDomain/,
    );
  });

  it("rejects a non-hex themeColor", () => {
    expect(() => parseOrgConfig({ ...VALID_CONFIG, themeColor: "orange" })).toThrow(/themeColor/);
  });

  it("rejects a non-URL website", () => {
    expect(() => parseOrgConfig({ ...VALID_CONFIG, website: "www.example.com" })).toThrow(
      /website/,
    );
  });
});

describe("org", () => {
  it("exposes the validated customization/org.ts config", () => {
    expect(org).toEqual(orgConfig);
  });
});
