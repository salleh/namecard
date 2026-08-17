import { describe, expect, it } from "vitest";
import { EDITABLE_TEXT_FIELDS } from "./editableFields";
import {
  isLockableField,
  LOCKABLE_FIELDS,
  parseLockedFieldsForm,
  stripLockedFields,
} from "./fieldPolicy";

// A full editable-field payload where each value echoes its field name, so tests
// can assert exactly which keys survived.
function fullPayload(): Record<(typeof EDITABLE_TEXT_FIELDS)[number], string> {
  const out = {} as Record<(typeof EDITABLE_TEXT_FIELDS)[number], string>;
  for (const field of EDITABLE_TEXT_FIELDS) {
    out[field] = `value:${field}`;
  }
  return out;
}

describe("LOCKABLE_FIELDS", () => {
  it("covers exactly the editable text fields", () => {
    expect(LOCKABLE_FIELDS).toEqual(EDITABLE_TEXT_FIELDS);
  });
});

describe("isLockableField", () => {
  it("accepts every known editable field", () => {
    for (const field of EDITABLE_TEXT_FIELDS) {
      expect(isLockableField(field)).toBe(true);
    }
  });

  it("rejects unknown or internal field names", () => {
    expect(isLockableField("photo")).toBe(false);
    expect(isLockableField("id")).toBe(false);
    expect(isLockableField("entraObjectId")).toBe(false);
    expect(isLockableField("")).toBe(false);
    expect(isLockableField("__proto__")).toBe(false);
  });
});

describe("parseLockedFieldsForm", () => {
  it("returns the fields whose lock checkbox is present", () => {
    const form = new FormData();
    form.set("lock:jobTitle", "on");
    form.set("lock:department", "on");

    expect(parseLockedFieldsForm(form)).toEqual(["jobTitle", "department"]);
  });

  it("returns an empty list when nothing is checked", () => {
    expect(parseLockedFieldsForm(new FormData())).toEqual([]);
  });

  it("ignores unknown or wrongly-prefixed keys a client might smuggle in", () => {
    const form = new FormData();
    form.set("lock:jobTitle", "on");
    form.set("lock:notAField", "on");
    form.set("jobTitle", "on"); // missing the lock: prefix
    form.set("lock:__proto__", "on");

    expect(parseLockedFieldsForm(form)).toEqual(["jobTitle"]);
  });

  it("returns locked fields in canonical order regardless of submit order", () => {
    const form = new FormData();
    // Append out of declared order; result must follow LOCKABLE_FIELDS order.
    form.set("lock:website", "on");
    form.set("lock:displayName", "on");
    form.set("lock:email", "on");

    expect(parseLockedFieldsForm(form)).toEqual(["displayName", "email", "website"]);
  });
});

describe("stripLockedFields", () => {
  it("keeps every field when nothing is locked", () => {
    const payload = fullPayload();

    expect(stripLockedFields(payload, new Set())).toEqual(payload);
  });

  it("omits locked fields and keeps the rest", () => {
    const result = stripLockedFields(fullPayload(), new Set(["jobTitle", "department"]));

    expect(result).not.toHaveProperty("jobTitle");
    expect(result).not.toHaveProperty("department");
    expect(result.email).toBe("value:email");
    expect(result.displayName).toBe("value:displayName");
  });

  it("returns an empty object when every field is locked", () => {
    const result = stripLockedFields(fullPayload(), new Set(EDITABLE_TEXT_FIELDS));

    expect(Object.keys(result)).toHaveLength(0);
  });

  it("does not mutate the input payload", () => {
    const payload = fullPayload();
    const snapshot = { ...payload };

    stripLockedFields(payload, new Set(["email"]));

    expect(payload).toEqual(snapshot);
  });

  it("ignores locked-set entries that are not lockable fields", () => {
    const result = stripLockedFields(fullPayload(), new Set(["notAField", "email"]));

    // Only the real field is dropped; the bogus entry has no effect.
    expect(result).not.toHaveProperty("email");
    expect(result.jobTitle).toBe("value:jobTitle");
  });
});
