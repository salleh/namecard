import { z } from "zod";
import type { EditableTextField, EditableTextFields } from "./editableFields";
import { EDITABLE_TEXT_FIELDS } from "./editableFields";

// Length ceilings per field. Generous enough for real names/titles/addresses
// but bounded so a single field can't bloat the row or the QR payload.
const MAX_SHORT = 200;
const MAX_PHONE = 50;
const MAX_URL = 300;
const MAX_ADDRESS = 300;

// C0 control chars + DEL. Stripped from every field so a staff-supplied value
// can never inject a CR/LF and forge an extra vCard property line (the vCard
// builder strips these too — this is defense-in-depth at the boundary).
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

// Conservative, render-safe formats — deliberately the same guards the public
// page (src/app/[slug]/page.tsx) uses before emitting mailto:/tel:/href, so a
// value that validates here is also safe to render there.
const SAFE_EMAIL = /^[^\s?&,<>"']+@[^\s?&,<>"']+\.[^\s?&,<>"']+$/;
const SAFE_PHONE = /^[+()\-\s\d]+$/;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// A cleaned string: control chars stripped, trimmed. Missing/non-string input
// (a form key that wasn't submitted) becomes "". Bounded by `max` AFTER
// cleaning so trailing whitespace never trips the length check.
function cleaned(max: number, maxMessage: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.replace(CONTROL_CHARS, "").trim() : ""),
    z.string().max(max, maxMessage),
  );
}

// "" (blank) is always allowed and later mapped to null; a non-blank value must
// pass `predicate`. Keeps "leave it empty" frictionless while validating real input.
function optionalFormat(
  base: z.ZodType<string, z.ZodTypeDef, unknown>,
  predicate: (v: string) => boolean,
  message: string,
) {
  return base
    .refine((v) => v === "" || predicate(v), message)
    .transform((v) => (v === "" ? null : v));
}

const plainField = (max: number) =>
  cleaned(max, `Must be ${max} characters or fewer`).transform((v) => (v === "" ? null : v));

export const cardEditSchema = z.object({
  displayName: plainField(MAX_SHORT),
  givenName: plainField(MAX_SHORT),
  surname: plainField(MAX_SHORT),
  jobTitle: plainField(MAX_SHORT),
  department: plainField(MAX_SHORT),
  company: plainField(MAX_SHORT),
  email: optionalFormat(
    cleaned(MAX_SHORT, `Must be ${MAX_SHORT} characters or fewer`),
    (v) => SAFE_EMAIL.test(v),
    "Enter a valid email address",
  ),
  businessPhone: optionalFormat(
    cleaned(MAX_PHONE, `Must be ${MAX_PHONE} characters or fewer`),
    (v) => SAFE_PHONE.test(v),
    "Enter a valid phone number",
  ),
  mobilePhone: optionalFormat(
    cleaned(MAX_PHONE, `Must be ${MAX_PHONE} characters or fewer`),
    (v) => SAFE_PHONE.test(v),
    "Enter a valid phone number",
  ),
  faxNumber: optionalFormat(
    cleaned(MAX_PHONE, `Must be ${MAX_PHONE} characters or fewer`),
    (v) => SAFE_PHONE.test(v),
    "Enter a valid fax number",
  ),
  officeLocation: plainField(MAX_SHORT),
  address: plainField(MAX_ADDRESS),
  website: optionalFormat(
    cleaned(MAX_URL, `Must be ${MAX_URL} characters or fewer`),
    isHttpUrl,
    "Website must start with http:// or https://",
  ),
}) satisfies z.ZodType<EditableTextFields, z.ZodTypeDef, unknown>;

export type CardEditFieldErrors = Partial<Record<EditableTextField, string>>;

export type ParseCardEditResult =
  | { success: true; data: EditableTextFields }
  | { success: false; errors: CardEditFieldErrors };

// Parses a submitted `/me` edit form. Reads only the known editable keys from
// FormData (ignores anything extra a client might smuggle in), validates and
// normalizes each, and returns either the persist-ready fields or a
// per-field error map (first message per field) for re-rendering the form.
export function parseCardEditForm(formData: FormData): ParseCardEditResult {
  const raw: Record<string, unknown> = {};
  for (const field of EDITABLE_TEXT_FIELDS) {
    raw[field] = formData.get(field);
  }

  const result = cardEditSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: CardEditFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    // Only map issues whose path is a known editable field (keeps the cast
    // sound if the schema ever grows a nested/refined path).
    if (
      typeof field === "string" &&
      (EDITABLE_TEXT_FIELDS as readonly string[]).includes(field) &&
      !(field in errors)
    ) {
      errors[field as EditableTextField] = issue.message;
    }
  }
  return { success: false, errors };
}
