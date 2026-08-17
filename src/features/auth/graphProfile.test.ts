import { describe, expect, it } from "vitest";
import { graphMeResponseSchema, mapGraphProfileToVCardFields } from "./graphProfile";

describe("graphMeResponseSchema", () => {
  it("parses a full Graph /me payload", () => {
    const payload = {
      id: "oid-1",
      displayName: "Jane Tan",
      givenName: "Jane",
      surname: "Tan",
      jobTitle: "Marketing Executive",
      department: "Marketing",
      companyName: "Example Org",
      mail: "jane.tan@example.com",
      userPrincipalName: "jane.tan@example.com",
      businessPhones: ["+60312345678"],
      mobilePhone: "+60123456789",
      officeLocation: "HQ",
    };

    const result = graphMeResponseSchema.parse(payload);

    expect(result.id).toBe("oid-1");
    expect(result.businessPhones).toEqual(["+60312345678"]);
  });

  it("accepts a minimal payload with only id", () => {
    const result = graphMeResponseSchema.parse({ id: "oid-minimal" });

    expect(result.id).toBe("oid-minimal");
    expect(result.displayName).toBeUndefined();
  });

  it("accepts explicit nulls for optional fields (Graph's actual null shape)", () => {
    const result = graphMeResponseSchema.parse({
      id: "oid-nulls",
      displayName: null,
      businessPhones: null,
    });

    expect(result.displayName).toBeNull();
    expect(result.businessPhones).toBeNull();
  });

  it("rejects a payload missing id", () => {
    expect(() => graphMeResponseSchema.parse({ displayName: "No Id" })).toThrow();
  });

  it("rejects a payload with an empty id", () => {
    expect(() => graphMeResponseSchema.parse({ id: "" })).toThrow();
  });

  it("rejects a payload with a non-string businessPhones entry", () => {
    expect(() => graphMeResponseSchema.parse({ id: "oid-1", businessPhones: [123] })).toThrow();
  });
});

describe("mapGraphProfileToVCardFields", () => {
  it("maps every Graph field to its StaffCard counterpart", () => {
    const profile = graphMeResponseSchema.parse({
      id: "oid-1",
      displayName: "Jane Tan",
      givenName: "Jane",
      surname: "Tan",
      jobTitle: "Marketing Executive",
      department: "Marketing",
      companyName: "Example Org",
      mail: "jane.tan@example.com",
      userPrincipalName: "jane.tan@example.com",
      businessPhones: ["+60312345678", "+60312345679"],
      mobilePhone: "+60123456789",
      faxNumber: "+60312345680",
      officeLocation: "HQ",
    });

    expect(mapGraphProfileToVCardFields(profile)).toEqual({
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
      officeLocation: "HQ",
      address: null,
    });
  });

  it("collapses the structured Graph address components into one address string", () => {
    const profile = graphMeResponseSchema.parse({
      id: "oid-1",
      streetAddress: "1 Example Street",
      city: "Kuala Lumpur",
      state: "WP",
      postalCode: "50000",
      country: "Malaysia",
    });

    expect(mapGraphProfileToVCardFields(profile).address).toBe(
      "1 Example Street, Kuala Lumpur, WP, 50000, Malaysia",
    );
  });

  it("drops blank address components and nulls a fully-empty address", () => {
    const partial = graphMeResponseSchema.parse({
      id: "oid-1",
      streetAddress: "1 Example Street",
      city: "  ",
      country: "Malaysia",
    });
    const empty = graphMeResponseSchema.parse({ id: "oid-1", city: null });

    expect(mapGraphProfileToVCardFields(partial).address).toBe("1 Example Street, Malaysia");
    expect(mapGraphProfileToVCardFields(empty).address).toBeNull();
  });

  it("takes only the first businessPhones entry", () => {
    const profile = graphMeResponseSchema.parse({
      id: "oid-1",
      businessPhones: ["+60312345678", "+60312345679"],
    });

    expect(mapGraphProfileToVCardFields(profile).businessPhone).toBe("+60312345678");
  });

  it("falls back to userPrincipalName when mail is absent", () => {
    const profile = graphMeResponseSchema.parse({
      id: "oid-1",
      userPrincipalName: "jane.tan@example.com",
    });

    expect(mapGraphProfileToVCardFields(profile).email).toBe("jane.tan@example.com");
  });

  it("falls back to userPrincipalName when mail is explicitly null", () => {
    const profile = graphMeResponseSchema.parse({
      id: "oid-1",
      mail: null,
      userPrincipalName: "jane.tan@example.com",
    });

    expect(mapGraphProfileToVCardFields(profile).email).toBe("jane.tan@example.com");
  });

  it("nulls every field when the profile has only an id", () => {
    const profile = graphMeResponseSchema.parse({ id: "oid-minimal" });

    expect(mapGraphProfileToVCardFields(profile)).toEqual({
      displayName: null,
      givenName: null,
      surname: null,
      jobTitle: null,
      department: null,
      company: null,
      email: null,
      businessPhone: null,
      mobilePhone: null,
      faxNumber: null,
      officeLocation: null,
      address: null,
    });
  });

  it("nulls businessPhone when businessPhones is an empty array", () => {
    const profile = graphMeResponseSchema.parse({ id: "oid-1", businessPhones: [] });

    expect(mapGraphProfileToVCardFields(profile).businessPhone).toBeNull();
  });
});
