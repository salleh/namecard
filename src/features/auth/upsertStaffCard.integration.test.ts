import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetStaffCards, testPrisma } from "../../../prisma/test/testPrismaClient";
import { graphMeResponseSchema } from "./graphProfile";
import {
  EmailSlugCollisionError,
  MissingEmailSlugError,
  upsertStaffCardFromGraph,
} from "./upsertStaffCard";

beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("namecard_test")) {
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL does not target namecard_test (got "${url}").`,
    );
  }
  await resetStaffCards();
});

afterEach(async () => {
  await resetStaffCards();
});

afterAll(async () => {
  await testPrisma.$disconnect();
  await prisma.$disconnect();
});

const FIRST_LOGIN_PROFILE = graphMeResponseSchema.parse({
  id: "oid-jane",
  displayName: "Jane Tan",
  givenName: "Jane",
  surname: "Tan",
  jobTitle: "Marketing Executive",
  department: "Marketing",
  companyName: "Example Org",
  mail: "jane.tan@example.com",
  businessPhones: ["+60312345678"],
  mobilePhone: "+60123456789",
  officeLocation: "HQ",
});

describe("upsertStaffCardFromGraph", () => {
  it("creates an activated StaffCard with derived slug + snapshot on first login", async () => {
    const photo = new Uint8Array([1, 2, 3]);

    const card = await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, photo);

    expect(card.entraObjectId).toBe("oid-jane");
    expect(card.emailSlug).toBe("jane.tan");
    expect(card.activated).toBe(true);
    expect(card.displayName).toBe("Jane Tan");
    expect(card.businessPhone).toBe("+60312345678");
    expect(card.photo).toEqual(new Uint8Array(photo));
    expect(card.graphSnapshot).toMatchObject({ id: "oid-jane", displayName: "Jane Tan" });
  });

  it("creates a StaffCard with a null photo when Graph returned no photo", async () => {
    const card = await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);

    expect(card.photo).toBeNull();
  });

  it("does not overwrite a staff-edited field on a second login (source-of-truth invariant)", async () => {
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);

    // Simulate a staff override made via /me (Step 6): edit displayName directly.
    await testPrisma.staffCard.update({
      where: { entraObjectId: "oid-jane" },
      data: { displayName: "Jane Tan (Preferred Name)" },
    });

    const updatedGraphProfile = graphMeResponseSchema.parse({
      ...FIRST_LOGIN_PROFILE,
      displayName: "Jane Tan", // Entra's value, unchanged from Graph's perspective
      jobTitle: "Senior Marketing Executive", // Entra changed this too
    });

    const card = await upsertStaffCardFromGraph(updatedGraphProfile, null);

    // The staff override survives...
    expect(card.displayName).toBe("Jane Tan (Preferred Name)");
    // ...and so does every other vCard field from the original create, even
    // though Graph's jobTitle has since changed.
    expect(card.jobTitle).toBe("Marketing Executive");
  });

  it("does not overwrite the photo on a second login", async () => {
    const originalPhoto = new Uint8Array([1, 2, 3]);
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, originalPhoto);

    const newPhotoFromGraph = new Uint8Array([9, 9, 9]);
    const card = await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, newPhotoFromGraph);

    expect(card.photo).toEqual(new Uint8Array(originalPhoto));
  });

  it("re-affirms activated=true and refreshes graphSnapshot on re-login", async () => {
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);
    await testPrisma.staffCard.update({
      where: { entraObjectId: "oid-jane" },
      data: { disabled: false, activated: true },
    });

    const refreshedProfile = graphMeResponseSchema.parse({
      ...FIRST_LOGIN_PROFILE,
      jobTitle: "Senior Marketing Executive",
    });
    const card = await upsertStaffCardFromGraph(refreshedProfile, null);

    expect(card.activated).toBe(true);
    expect(card.graphSnapshot).toMatchObject({ jobTitle: "Senior Marketing Executive" });
  });

  it("never writes duplicate rows for the same entraObjectId across repeated logins", async () => {
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);

    const count = await testPrisma.staffCard.count({ where: { entraObjectId: "oid-jane" } });
    expect(count).toBe(1);
  });

  it("throws MissingEmailSlugError when neither mail nor userPrincipalName is usable", async () => {
    const noEmailProfile = graphMeResponseSchema.parse({ id: "oid-no-email" });

    await expect(upsertStaffCardFromGraph(noEmailProfile, null)).rejects.toThrow(
      MissingEmailSlugError,
    );

    expect(await testPrisma.staffCard.count({ where: { entraObjectId: "oid-no-email" } })).toBe(0);
  });

  it("throws EmailSlugCollisionError when a different Entra account already owns the emailSlug, and does not overwrite the existing row", async () => {
    await upsertStaffCardFromGraph(FIRST_LOGIN_PROFILE, null);

    // A different Entra object (e.g. the local part was reissued to a new
    // hire) resolves to the SAME emailSlug.
    const collidingProfile = graphMeResponseSchema.parse({
      id: "oid-someone-else",
      displayName: "New Hire",
      mail: "jane.tan@example.com",
    });

    await expect(upsertStaffCardFromGraph(collidingProfile, null)).rejects.toThrow(
      EmailSlugCollisionError,
    );

    // The original row is untouched — the public slug keeps resolving to
    // the account that legitimately owns it, not silently reassigned.
    const existing = await testPrisma.staffCard.findUniqueOrThrow({
      where: { entraObjectId: "oid-jane" },
    });
    expect(existing.displayName).toBe("Jane Tan");

    // No row was created for the colliding account either.
    expect(await testPrisma.staffCard.count({ where: { entraObjectId: "oid-someone-else" } })).toBe(
      0,
    );
  });
});
