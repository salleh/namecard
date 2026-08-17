import { describe, expect, it } from "vitest";
import { EDITABLE_TEXT_FIELDS } from "./editableFields";
import { parseCardEditForm } from "./editSchema";

// Builds a FormData with sensible valid defaults, overridable per test.
function formFrom(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const field of EDITABLE_TEXT_FIELDS) {
    fd.set(field, "");
  }
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

describe("parseCardEditForm", () => {
  it("accepts a fully blank form and maps every field to null", () => {
    const result = parseCardEditForm(formFrom());

    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const field of EDITABLE_TEXT_FIELDS) {
      expect(result.data[field]).toBeNull();
    }
  });

  it("trims surrounding whitespace and keeps the inner value", () => {
    const result = parseCardEditForm(formFrom({ displayName: "  Jane Tan  " }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.displayName).toBe("Jane Tan");
  });

  it("maps a whitespace-only value to null (not an empty vCard line)", () => {
    const result = parseCardEditForm(formFrom({ jobTitle: "   " }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.jobTitle).toBeNull();
  });

  it("strips control characters to defend against vCard line injection", () => {
    const result = parseCardEditForm(formFrom({ department: "Retail\r\nTEL:666" }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.department).toBe("RetailTEL:666");
    expect(result.data.department).not.toContain("\r");
    expect(result.data.department).not.toContain("\n");
  });

  it("accepts a valid business email override", () => {
    const result = parseCardEditForm(formFrom({ email: "jane.tan@example.com" }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("jane.tan@example.com");
  });

  it("rejects a malformed email", () => {
    const result = parseCardEditForm(formFrom({ email: "not-an-email" }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.email).toBeTruthy();
  });

  it("accepts an https website", () => {
    const result = parseCardEditForm(formFrom({ website: "https://example.com" }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.website).toBe("https://example.com");
  });

  it("rejects a javascript: pseudo-URL in website", () => {
    const result = parseCardEditForm(formFrom({ website: "javascript:alert(1)" }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.website).toBeTruthy();
  });

  it("accepts a phone number with common punctuation", () => {
    const result = parseCardEditForm(formFrom({ mobilePhone: "+60 (12) 345-6789" }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.mobilePhone).toBe("+60 (12) 345-6789");
  });

  it("rejects letters in a phone number", () => {
    const result = parseCardEditForm(formFrom({ businessPhone: "call-me" }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.businessPhone).toBeTruthy();
  });

  it("rejects an over-long field value", () => {
    const result = parseCardEditForm(formFrom({ displayName: "a".repeat(1000) }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.displayName).toBeTruthy();
  });

  it("reports multiple field errors at once", () => {
    const result = parseCardEditForm(formFrom({ email: "bad", website: "ftp://x" }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.email).toBeTruthy();
    expect(result.errors.website).toBeTruthy();
  });

  it("treats a missing form key as blank rather than throwing", () => {
    const fd = new FormData();
    fd.set("displayName", "Solo Field");

    const result = parseCardEditForm(fd);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.displayName).toBe("Solo Field");
    expect(result.data.email).toBeNull();
  });
});
