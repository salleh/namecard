// vCard-relevant subset of `StaffCard` (see prisma/schema.prisma). All text
// fields are nullable/optional because not every field is known at first
// login and staff may leave some blank (CLAUDE.md "Authentication & Data
// Flow"). The photo is no longer part of the input: it is referenced by URL
// (see `BuildVCardOptions.photoUrl`) rather than embedded as bytes.
export interface VCardInput {
  displayName?: string | null;
  givenName?: string | null;
  surname?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  company?: string | null;
  email?: string | null;
  businessPhone?: string | null;
  mobilePhone?: string | null;
  faxNumber?: string | null;
  officeLocation?: string | null;
  address?: string | null;
  website?: string | null;
}

// How the vCard carries the photo — chosen per output channel:
//   - `uri`: a `PHOTO;VALUE=URI` reference to the public `/avatar/<slug>`
//     endpoint. Short, so it keeps the QR scannable — used for the QR payload.
//   - `embed`: base64-inlined `PHOTO;ENCODING=b` bytes. Self-contained (no
//     network needed to import) and the most broadly-supported form for `.vcf`
//     file import into address books — used for the download.
export type VCardPhoto = { kind: "uri"; url: string } | { kind: "embed"; bytes: Uint8Array };

export interface BuildVCardOptions {
  /** Photo to include, or omit/null for no PHOTO line. See `VCardPhoto`. */
  photo?: VCardPhoto | null;
}
