// Pure helpers for the admin field-lock policy (HR enhancement, Request 1). No
// DB, no env — safe to import from client components (the admin config form) and
// from server actions alike. The persistence layer lives in
// fieldPolicyRepository.ts; enforcement of locks on save lands with the `/me`
// changes (Request 2).
import { EDITABLE_TEXT_FIELDS, type EditableTextField } from "./editableFields";

// The vCard fields an admin is allowed to lock. Derived from the single source
// of truth for editable fields, so a new editable field is automatically
// lockable without touching this module.
export const LOCKABLE_FIELDS = EDITABLE_TEXT_FIELDS;
export type LockableField = EditableTextField;

const LOCKABLE_SET: ReadonlySet<string> = new Set(LOCKABLE_FIELDS);

// Narrows an arbitrary string to a known lockable field. Every write path runs
// through this so a client can never smuggle an unknown field name into storage.
export function isLockableField(value: string): value is LockableField {
  return LOCKABLE_SET.has(value);
}

// Reads the admin field-lock form. Each field renders one checkbox named
// `lock:<field>`; a checkbox only appears in FormData when checked, so a present
// value means "lock this field". Only known lockable fields are honored, and the
// result is returned in canonical order (never trusting client-supplied order).
export function parseLockedFieldsForm(formData: FormData): LockableField[] {
  const locked: LockableField[] = [];
  for (const field of LOCKABLE_FIELDS) {
    if (formData.get(`lock:${field}`) != null) {
      locked.push(field);
    }
  }
  return locked;
}

// Server-side enforcement for the `/me` editor: given a full edit payload and the
// current locked set, returns a new payload with every locked field removed, so
// the persisted UPDATE never touches a locked column (its stored value stays as
// the admin set it). Pure and immutable — the input object is not mutated. This
// is the trust boundary: the client disables locked inputs, but a crafted POST
// could still include them, so the drop happens here regardless.
export function stripLockedFields<T>(
  fields: Readonly<Record<LockableField, T>>,
  locked: ReadonlySet<string>,
): Partial<Record<LockableField, T>> {
  const out: Partial<Record<LockableField, T>> = {};
  for (const field of LOCKABLE_FIELDS) {
    if (!locked.has(field)) {
      out[field] = fields[field];
    }
  }
  return out;
}
