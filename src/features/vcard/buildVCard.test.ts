import { describe, expect, it } from "vitest";
import { COMPANY_DEFAULTS } from "../../config/company";
import { buildVCard } from "./buildVCard";
import type { VCardInput } from "./types";

const FULL_INPUT: VCardInput = {
  displayName: "Jane Tan",
  givenName: "Jane",
  surname: "Tan",
  jobTitle: "Marketing Executive",
  department: "Marketing",
  company: "Example Org",
  email: "jane.tan@example.com",
  businessPhone: "+60312345678",
  mobilePhone: "+60123456789",
  faxNumber: "+60312345680",
  officeLocation: "HQ Tower, Level 5",
  address: "1 Example Street, 50000 Kuala Lumpur",
  website: "https://www.example.com",
};

const PHOTO_URL = "https://namecard.example.com/avatar/jane.tan";
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function lines(vcard: string): string[] {
  return vcard.split("\r\n").filter((line) => line !== "");
}

describe("buildVCard", () => {
  it("begins with BEGIN:VCARD and VERSION:3.0", () => {
    const result = buildVCard(FULL_INPUT, {});

    const physicalLines = lines(result);
    expect(physicalLines[0]).toBe("BEGIN:VCARD");
    expect(physicalLines[1]).toBe("VERSION:3.0");
  });

  it("ends with END:VCARD", () => {
    const result = buildVCard(FULL_INPUT, {});

    const physicalLines = lines(result);
    expect(physicalLines.at(-1)).toBe("END:VCARD");
  });

  it("uses CRLF line endings throughout, including the trailing line", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).not.toMatch(/(?<!\r)\n/); // every \n is preceded by \r
    expect(result.endsWith("\r\n")).toBe(true);
  });

  it("formats the N property as family;given;;;", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("N:Tan;Jane;;;\r\n");
  });

  it("formats FN from displayName", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("FN:Jane Tan\r\n");
  });

  it("falls back FN to given + surname when displayName is blank (HIGH-1)", () => {
    const input: VCardInput = { ...FULL_INPUT, displayName: null };

    const result = buildVCard(input, {});

    expect(result).toContain("FN:Jane Tan\r\n");
  });

  it("falls back FN to the email local part when displayName and name parts are blank", () => {
    const input: VCardInput = {
      ...FULL_INPUT,
      displayName: "   ",
      givenName: null,
      surname: undefined,
    };

    const result = buildVCard(input, {});

    expect(result).toContain("FN:jane.tan\r\n");
  });

  it("formats ORG as company;department, excluding officeLocation", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("ORG:Example Org;Marketing\r\n");
    expect(result).not.toContain("ORG:Example Org;Marketing;"); // no 3rd org-unit component
  });

  it("formats the business phone as TEL;TYPE=WORK,VOICE", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("TEL;TYPE=WORK,VOICE:+60312345678\r\n");
  });

  it("formats the mobile phone as TEL;TYPE=CELL", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("TEL;TYPE=CELL:+60123456789\r\n");
  });

  it("formats the fax number as TEL;TYPE=WORK,FAX", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("TEL;TYPE=WORK,FAX:+60312345680\r\n");
  });

  it("formats the email as EMAIL;TYPE=INTERNET", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("EMAIL;TYPE=INTERNET:jane.tan@example.com\r\n");
  });

  it("formats ADR;TYPE=WORK with officeLocation as extended-address and address as street", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain(
      "ADR;TYPE=WORK:;HQ Tower\\, Level 5;1 Example Street\\, 50000 Kuala Lumpur\r\n",
    );
  });

  it("formats the website as URL", () => {
    const result = buildVCard(FULL_INPUT, {});

    expect(result).toContain("URL:https://www.example.com\r\n");
  });

  it("omits a line entirely for a missing/blank field", () => {
    const input: VCardInput = { ...FULL_INPUT, jobTitle: null, mobilePhone: "   " };

    const result = buildVCard(input, {});

    expect(result).not.toContain("TITLE:");
    expect(result).not.toContain("TYPE=CELL");
  });

  it("omits the N line when both surname and givenName are blank", () => {
    const input: VCardInput = { ...FULL_INPUT, surname: null, givenName: undefined };

    const result = buildVCard(input, {});

    expect(result).not.toMatch(/\r\nN:/);
  });

  it("formats N with an empty given-name component when only surname is provided", () => {
    const input: VCardInput = { ...FULL_INPUT, givenName: null };

    const result = buildVCard(input, {});

    expect(result).toContain("N:Tan;;;;\r\n");
  });

  it("formats N with an empty family-name component when only givenName is provided", () => {
    const input: VCardInput = { ...FULL_INPUT, surname: undefined };

    const result = buildVCard(input, {});

    expect(result).toContain("N:;Jane;;;\r\n");
  });

  it("omits the ORG line when company and department are both blank", () => {
    const input: VCardInput = { ...FULL_INPUT, company: null, department: null };

    const result = buildVCard(input, {});

    expect(result).not.toContain("ORG:");
  });

  it("emits PHOTO;VALUE=URI for a uri photo, and omits it when no photo is given", () => {
    const withPhoto = buildVCard(FULL_INPUT, { photo: { kind: "uri", url: PHOTO_URL } });
    const withoutPhoto = buildVCard(FULL_INPUT, {});

    expect(withPhoto).toContain(`PHOTO;VALUE=URI:${PHOTO_URL}\r\n`);
    expect(withoutPhoto).not.toContain("PHOTO");
  });

  it("emits base64 PHOTO;ENCODING=b with the sniffed image type for an embed photo", () => {
    const result = buildVCard(FULL_INPUT, { photo: { kind: "embed", bytes: PNG_BYTES } });

    expect(result).toContain(
      `PHOTO;ENCODING=b;TYPE=PNG:${Buffer.from(PNG_BYTES).toString("base64")}`,
    );
  });

  it("omits PHOTO for a null photo, a blank uri, or empty embed bytes", () => {
    expect(buildVCard(FULL_INPUT, { photo: null })).not.toContain("PHOTO");
    expect(buildVCard(FULL_INPUT, { photo: { kind: "uri", url: "   " } })).not.toContain("PHOTO");
    expect(
      buildVCard(FULL_INPUT, { photo: { kind: "embed", bytes: new Uint8Array() } }),
    ).not.toContain("PHOTO");
  });

  it("strips control characters from a uri photo to prevent property injection", () => {
    const result = buildVCard(FULL_INPUT, {
      photo: { kind: "uri", url: "https://x.example.com/avatar/jane\r\nNOTE:injected" },
    });

    expect(result.split("\r\n")).not.toContain("NOTE:injected");
    expect(result).toContain("PHOTO;VALUE=URI:https://x.example.com/avatar/janeNOTE:injected\r\n");
  });

  it("falls back to the company default website when the input website is blank", () => {
    const input: VCardInput = { ...FULL_INPUT, website: undefined };

    const result = buildVCard(input, {});

    expect(result).toContain(`URL:${COMPANY_DEFAULTS.website}\r\n`);
  });

  // The real COMPANY_DEFAULTS.address is now seeded (config/company.ts), so a
  // blank input address falls back to it and the ADR line is emitted. The
  // all-blank omission branch is covered against a mocked blank config in
  // buildVCard.blankCompanyDefaults.test.ts, decoupling it from the real value.
  it("falls back to the real company default address in ADR when input address and officeLocation are blank", () => {
    const input: VCardInput = { ...FULL_INPUT, address: null, officeLocation: null };

    const result = buildVCard(input, {});

    expect(result).toContain("ADR;TYPE=WORK:;;");
    // The default address contains vCard-escaped commas, so compare against the
    // first comma-free chunk of the configured value.
    const addressChunk = COMPANY_DEFAULTS.address.split(",")[0] ?? "";
    expect(addressChunk.length).toBeGreaterThan(0);
    expect(result).toContain(addressChunk);
  });

  it("prefers a staff-provided address/website over the company default", () => {
    const input: VCardInput = {
      ...FULL_INPUT,
      officeLocation: null,
      address: "Custom Office, Level 9",
      website: "https://jane.example.com",
    };

    const result = buildVCard(input, {});

    expect(result).toContain("ADR;TYPE=WORK:;;Custom Office\\, Level 9\r\n");
    expect(result).toContain("URL:https://jane.example.com\r\n");
    expect(result).not.toContain(COMPANY_DEFAULTS.website);
  });

  it("escapes special characters within property values", () => {
    const input: VCardInput = { ...FULL_INPUT, jobTitle: 'R&D, Lead; "Ops"\\Team' };

    const result = buildVCard(input, {});

    expect(result).toContain('TITLE:R&D\\, Lead\\; "Ops"\\\\Team\r\n');
  });

  it("folds a long property value across multiple physical lines", () => {
    const input: VCardInput = { ...FULL_INPUT, jobTitle: "Senior ".repeat(20) + "Executive" };

    const result = buildVCard(input, {});
    const titleLineStart = result.indexOf("TITLE:");
    const nextPropertyStart = result.indexOf("\r\nTEL", titleLineStart);
    const titleBlock = result.slice(titleLineStart, nextPropertyStart);

    expect(titleBlock.split("\r\n").length).toBeGreaterThan(1);
    expect(
      titleBlock
        .split("\r\n")
        .slice(1)
        .every((l) => l.startsWith(" ")),
    ).toBe(true);
  });

  it("emits only the company-default lines (ADR, URL) for a minimal input", () => {
    const minimal: VCardInput = {};

    const result = buildVCard(minimal, {});

    // No per-staff fields, but company defaults still apply (ADR + URL).
    expect(result).toContain("ADR;TYPE=WORK:;;");
    expect(result).toContain(`URL:${COMPANY_DEFAULTS.website}\r\n`);
    for (const absent of ["\r\nN:", "FN:", "ORG:", "TITLE:", "TEL", "EMAIL", "PHOTO"]) {
      expect(result).not.toContain(absent);
    }
  });

  it("strips control characters from the URL to prevent vCard property injection", () => {
    const input: VCardInput = { ...FULL_INPUT, website: "https://x.example.com\r\nNOTE:injected" };

    const result = buildVCard(input, {});
    const physicalLines = result.split("\r\n");

    expect(physicalLines).not.toContain("NOTE:injected");
    expect(result).toContain("URL:https://x.example.comNOTE:injected\r\n");
  });
});
