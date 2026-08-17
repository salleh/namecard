// Single source of truth for the staff-editable vCard text fields shown on the
// `/me` editor (Step 6). Everything downstream — the Zod edit schema, the
// FormData extraction, the form inputs, and the Prisma update payload — derives
// from this list so a new field is added in exactly one place.
//
// Deliberately excludes `emailSlug` (fixed at first login — the public URL must
// never change out from under an already-shared card), `entraObjectId`/`id`
// (internal identifiers, never client-editable), `photo` (binary, handled by
// its own upload path), and the `activated`/`disabled` gates (admin-only,
// Step 7). `email` is present because CLAUDE.md allows overriding the vCard
// email — that override affects only the card, never the slug or Entra.
export const EDITABLE_TEXT_FIELDS = [
  "displayName",
  "givenName",
  "surname",
  "jobTitle",
  "department",
  "company",
  "email",
  "businessPhone",
  "mobilePhone",
  "faxNumber",
  "officeLocation",
  "address",
  "website",
] as const;

export type EditableTextField = (typeof EDITABLE_TEXT_FIELDS)[number];

// The persisted shape: every editable field is a string or null (null = the
// field is left blank / falls back to a company default where one applies).
export type EditableTextFields = Record<EditableTextField, string | null>;

// Human-readable label per field, in display order. Single source of truth for
// every surface that names these fields — the `/me` editor and the admin
// field-lock config both read it, so a wording change happens in one place.
export const FIELD_LABELS: Record<EditableTextField, string> = {
  displayName: "Display name",
  givenName: "First name",
  surname: "Last name",
  jobTitle: "Job title",
  department: "Department",
  company: "Company",
  email: "Email",
  businessPhone: "Office phone",
  mobilePhone: "Mobile phone",
  faxNumber: "Fax",
  officeLocation: "Office location",
  address: "Address",
  website: "Website",
};
