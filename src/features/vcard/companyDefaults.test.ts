import { describe, expect, it } from "vitest";
import { COMPANY_DEFAULTS } from "../../config/company";
import { resolveCompanyDefaults } from "./companyDefaults";

describe("resolveCompanyDefaults", () => {
  it("falls back to the company default address when the input address is missing", () => {
    const result = resolveCompanyDefaults({ address: undefined, website: undefined });

    expect(result.address).toBe(COMPANY_DEFAULTS.address);
  });

  it("falls back to the company default address when the input address is an empty/whitespace string", () => {
    const result = resolveCompanyDefaults({ address: "   ", website: undefined });

    expect(result.address).toBe(COMPANY_DEFAULTS.address);
  });

  it("falls back to the company default website when the input website is null", () => {
    const result = resolveCompanyDefaults({ address: undefined, website: null });

    expect(result.website).toBe(COMPANY_DEFAULTS.website);
  });

  it("uses a non-blank input address to override the company default", () => {
    const result = resolveCompanyDefaults({ address: "1 Custom Street", website: undefined });

    expect(result.address).toBe("1 Custom Street");
  });

  it("uses a non-blank input website to override the company default", () => {
    const result = resolveCompanyDefaults({
      address: undefined,
      website: "https://staff.example.com",
    });

    expect(result.website).toBe("https://staff.example.com");
  });

  it("does not mutate the input object", () => {
    const input = { address: undefined, website: undefined };
    const inputCopy = { ...input };

    resolveCompanyDefaults(input);

    expect(input).toEqual(inputCopy);
  });
});
