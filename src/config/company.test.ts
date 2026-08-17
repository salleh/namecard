import { describe, expect, it } from "vitest";
import { orgConfig } from "../../customization/org";
import { COMPANY_DEFAULTS } from "./company";

describe("COMPANY_DEFAULTS", () => {
  it("derives the company name from the org customization file", () => {
    expect(COMPANY_DEFAULTS.company).toBe(orgConfig.orgLegalName);
  });

  it("derives website and address from the org customization file", () => {
    expect(COMPANY_DEFAULTS.website).toBe(orgConfig.website);
    expect(COMPANY_DEFAULTS.address).toBe(orgConfig.address);
  });

  it("uses an https website url", () => {
    expect(COMPANY_DEFAULTS.website).toMatch(/^https:\/\//);
  });
});
