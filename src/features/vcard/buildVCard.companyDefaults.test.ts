import { describe, expect, it, vi } from "vitest";
import { buildVCard } from "./buildVCard";
import type { VCardInput } from "./types";

// The real COMPANY_DEFAULTS.address is currently a blank placeholder
// (config/company.ts TODO — seeded in Step 6), so the address-falls-back-to
// -a-non-blank-default path is exercised here against a mocked, non-blank
// config rather than depending on that placeholder value.
vi.mock("../../config/company", () => ({
  COMPANY_DEFAULTS: {
    company: "Example Org",
    website: "https://default.example.com",
    address: "1 Default Ave, Default City",
  },
}));

describe("buildVCard company-default merge (mocked non-blank defaults)", () => {
  it("falls back to the company default address and website when both are blank", () => {
    const input: VCardInput = { address: null, website: undefined };

    const result = buildVCard(input, {});

    expect(result).toContain("ADR;TYPE=WORK:;;1 Default Ave\\, Default City\r\n");
    expect(result).toContain("URL:https://default.example.com\r\n");
  });

  it("prefers a staff-provided address/website over the company default", () => {
    const input: VCardInput = {
      address: "Custom Office, Level 9",
      website: "https://jane.example.com",
    };

    const result = buildVCard(input, {});

    expect(result).toContain("ADR;TYPE=WORK:;;Custom Office\\, Level 9\r\n");
    expect(result).toContain("URL:https://jane.example.com\r\n");
    expect(result).not.toContain("Default Ave");
    expect(result).not.toContain("default.example.com");
  });
});
