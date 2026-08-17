import { resolveCompanyDefaults } from "./companyDefaults";
import { encodeEmbeddedPhoto } from "./embedPhoto";
import { foldLine } from "./lineFold";
import { joinTrimTrailingEmpty } from "./structuredValue";
import { escapeText } from "./textEscape";
import { isBlank } from "./textGuards";
import type { BuildVCardOptions, VCardInput, VCardPhoto } from "./types";

const CRLF = "\r\n";

// Unicode "Control" category (C0/C1 controls + DEL, incl. CR/LF). Stripped from
// URI-valued properties (URL, PHOTO) so a staff-supplied value cannot smuggle a
// CR/LF and inject additional vCard property lines.
const CONTROL_CHARS = /\p{Cc}/gu;

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

/**
 * Builds an RFC 2426 vCard 3.0 document from a `StaffCard`-shaped input.
 *
 * This is the single shared implementation feeding both public outputs
 * (CLAUDE.md "vCard & QR Requirements"). The photo is delivered per channel via
 * `options.photo`: a `uri` reference (the public `/avatar/<slug>` endpoint) for
 * the QR — short, keeps it scannable — and `embed`ded base64 for the `.vcf`
 * download — self-contained, so importing it needs no network round trip.
 */
export function buildVCard(input: VCardInput, options: BuildVCardOptions): string {
  const { address, website } = resolveCompanyDefaults(input);

  const contentLines: readonly (string | null)[] = [
    buildNameLine(input.surname, input.givenName),
    buildFormattedNameLine(input),
    buildOrgLine(input.company, input.department),
    propertyLine("TITLE", input.jobTitle),
    propertyLine("TEL", input.businessPhone, "TYPE=WORK,VOICE"),
    propertyLine("TEL", input.mobilePhone, "TYPE=CELL"),
    propertyLine("TEL", input.faxNumber, "TYPE=WORK,FAX"),
    propertyLine("EMAIL", input.email, "TYPE=INTERNET"),
    buildAddressLine(input.officeLocation, address),
    buildUrlLine(website),
    buildPhotoLine(options.photo),
  ];

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    ...contentLines.filter((line): line is string => line !== null),
    "END:VCARD",
  ];

  return lines.map(foldLine).join(CRLF) + CRLF;
}

// A single `NAME:value` (or `NAME;PARAMS:value`) line, or `null` when the
// value is blank (empty-field omission).
function propertyLine(
  name: string,
  value: string | null | undefined,
  params?: string,
): string | null {
  if (isBlank(value)) {
    return null;
  }
  const prefix = params ? `${name};${params}` : name;
  return `${prefix}:${escapeText(value)}`;
}

// FN (formatted name) is a REQUIRED property in RFC 2426 §3.1.1. Fall back
// through displayName -> "given surname" -> email local part so a card whose
// displayName was cleared on the /me editor (Step 6) still carries a valid,
// non-empty FN rather than producing a nameless (invalid) vCard.
function buildFormattedNameLine(input: VCardInput): string | null {
  const fn = firstNonBlank(
    input.displayName,
    joinNameParts(input.givenName, input.surname),
    emailLocalPart(input.email),
  );
  return fn === null ? null : `FN:${escapeText(fn)}`;
}

function joinNameParts(
  givenName: string | null | undefined,
  surname: string | null | undefined,
): string {
  return [givenName, surname]
    .filter((part): part is string => !isBlank(part))
    .map((part) => part.trim())
    .join(" ");
}

function emailLocalPart(email: string | null | undefined): string | null {
  if (isBlank(email)) {
    return null;
  }
  const [local] = email.trim().split("@");
  return isBlank(local) ? null : local;
}

function firstNonBlank(...values: readonly (string | null | undefined)[]): string | null {
  for (const value of values) {
    if (!isBlank(value)) {
      return value.trim();
    }
  }
  return null;
}

// N emits the full 5-component structure (family;given;additional;prefix;
// suffix) with trailing empties kept literal (RFC 2426 §3.1.2) — omitted only
// when both name parts are blank (FN still carries a name in that case).
function buildNameLine(
  surname: string | null | undefined,
  givenName: string | null | undefined,
): string | null {
  if (isBlank(surname) && isBlank(givenName)) {
    return null;
  }
  const family = isBlank(surname) ? "" : escapeText(surname);
  const given = isBlank(givenName) ? "" : escapeText(givenName);
  return `N:${family};${given};;;`;
}

// ORG:company;department — organization name + organizational unit only
// (RFC 2426 §3.5.5). officeLocation is a physical location, not an org unit, so
// it lives in the work ADR instead (see buildAddressLine). Trailing blank
// components are dropped; the line is omitted when both parts are blank.
function buildOrgLine(
  company: string | null | undefined,
  department: string | null | undefined,
): string | null {
  const components = [company, department].map((value) =>
    isBlank(value) ? "" : escapeText(value),
  );
  const joined = joinTrimTrailingEmpty(components);
  return joined === "" ? null : `ORG:${joined}`;
}

// ADR;TYPE=WORK:;<officeLocation>;<street> — officeLocation (suite/floor/room)
// rides as the extended-address component; the staff-fillable free-text
// `address` sits in the street component (locality/region/postal/country stay
// blank — the address is one collapsed string, not structured). The line is
// omitted only when both are blank.
function buildAddressLine(
  officeLocation: string | null | undefined,
  address: string,
): string | null {
  const extended = isBlank(officeLocation) ? "" : escapeText(officeLocation);
  const street = isBlank(address) ? "" : escapeText(address);
  if (extended === "" && street === "") {
    return null;
  }
  return `ADR;TYPE=WORK:;${extended};${street}`;
}

// URL is the URI value type (RFC 2426 §3.6.8), not TEXT, so it is not
// backslash-escaped. Control characters (esp. CR/LF) are stripped so a
// staff-supplied website cannot inject additional vCard property lines.
function buildUrlLine(website: string): string | null {
  if (isBlank(website)) {
    return null;
  }
  const sanitized = stripControlChars(website);
  return isBlank(sanitized) ? null : `URL:${sanitized}`;
}

// PHOTO property (RFC 2426 §3.1.4), delivered in one of two forms per channel:
//   - `uri`: `PHOTO;VALUE=URI:<url>` — an absolute URL to the public
//     `/avatar/<slug>` endpoint. Small, so it keeps the QR scannable. Control
//     chars (esp. CR/LF) are stripped so the URL cannot inject property lines.
//   - `embed`: `PHOTO;ENCODING=b;TYPE=...:<base64>` — self-contained bytes for
//     the `.vcf` download (see embedPhoto.ts).
// Omitted when there is no photo (empty embed bytes / blank URL).
function buildPhotoLine(photo: VCardPhoto | null | undefined): string | null {
  if (!photo) {
    return null;
  }
  if (photo.kind === "embed") {
    return photo.bytes.length === 0 ? null : encodeEmbeddedPhoto(photo.bytes);
  }
  if (isBlank(photo.url)) {
    return null;
  }
  const sanitized = stripControlChars(photo.url);
  return isBlank(sanitized) ? null : `PHOTO;VALUE=URI:${sanitized}`;
}
