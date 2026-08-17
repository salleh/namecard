import { describe, expect, it, vi } from "vitest";
import { buildVCard } from "./buildVCard";
import type { VCardInput } from "./types";

// Separate file (rather than a second vi.mock in the same module) so this
// blank-defaults fixture can't interfere with the non-blank fixture used in
// buildVCard.companyDefaults.test.ts — vi.mock factories are static/hoisted
// per file. Covers the "both input and company default are blank" branch
// for ADR/URL omission.
vi.mock("../../config/company", () => ({
  COMPANY_DEFAULTS: { company: "Example Org", website: "", address: "" },
}));

describe("buildVCard company-default merge (mocked blank defaults)", () => {
  it("omits both ADR and URL when the input and the company defaults are all blank", () => {
    const input: VCardInput = { address: null, website: undefined };

    const result = buildVCard(input, {});

    expect(result).not.toContain("ADR");
    expect(result).not.toContain("URL");
  });
});
