import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetStaffCards, testPrisma } from "../../../prisma/test/testPrismaClient";
import { getOwnerCardByEntraObjectId, updateOwnerCard } from "./ownerRepository";

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

async function seedOwner(entraObjectId: string): Promise<void> {
  await testPrisma.staffCard.create({
    data: {
      entraObjectId,
      emailSlug: "jane.tan",
      activated: true,
      displayName: "Jane Tan",
      jobTitle: "Marketing Executive",
      photo: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    },
  });
}

const BLANK_FIELDS = {
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
  website: null,
};

describe("getOwnerCardByEntraObjectId", () => {
  it("returns the owner's editable fields plus slug and photo presence", async () => {
    await seedOwner("oid-jane");

    const card = await getOwnerCardByEntraObjectId("oid-jane");

    expect(card).not.toBeNull();
    expect(card?.emailSlug).toBe("jane.tan");
    expect(card?.displayName).toBe("Jane Tan");
    expect(card?.hasPhoto).toBe(true);
  });

  it("returns a card even when unactivated/disabled (owner-scoped, not the public gate)", async () => {
    await testPrisma.staffCard.create({
      data: { entraObjectId: "oid-x", emailSlug: "x", activated: false, disabled: true },
    });

    const card = await getOwnerCardByEntraObjectId("oid-x");

    expect(card).not.toBeNull();
    expect(card?.emailSlug).toBe("x");
  });

  it("never exposes internal identifiers to the caller", async () => {
    await seedOwner("oid-jane");

    const card = await getOwnerCardByEntraObjectId("oid-jane");

    expect(card).not.toHaveProperty("id");
    expect(card).not.toHaveProperty("entraObjectId");
    expect(card).not.toHaveProperty("graphSnapshot");
    expect(card).not.toHaveProperty("photo");
  });

  it("returns null for an unknown Entra object id", async () => {
    expect(await getOwnerCardByEntraObjectId("ghost")).toBeNull();
  });
});

describe("updateOwnerCard", () => {
  it("updates only the owner's row, keyed by Entra object id", async () => {
    await seedOwner("oid-jane");

    await updateOwnerCard("oid-jane", {
      fields: { ...BLANK_FIELDS, jobTitle: "Senior Marketing Manager" },
    });

    const row = await testPrisma.staffCard.findUnique({ where: { entraObjectId: "oid-jane" } });
    expect(row?.jobTitle).toBe("Senior Marketing Manager");
    expect(row?.displayName).toBeNull();
  });

  it("never changes emailSlug, activated, or disabled", async () => {
    await seedOwner("oid-jane");

    await updateOwnerCard("oid-jane", { fields: { ...BLANK_FIELDS, displayName: "New Name" } });

    const row = await testPrisma.staffCard.findUnique({ where: { entraObjectId: "oid-jane" } });
    expect(row?.emailSlug).toBe("jane.tan");
    expect(row?.activated).toBe(true);
    expect(row?.disabled).toBe(false);
  });

  it("leaves the existing photo untouched when no photo change is requested", async () => {
    await seedOwner("oid-jane");

    await updateOwnerCard("oid-jane", { fields: { ...BLANK_FIELDS, displayName: "Jane" } });

    const row = await testPrisma.staffCard.findUnique({ where: { entraObjectId: "oid-jane" } });
    expect(row?.photo).not.toBeNull();
  });

  it("replaces the photo when new bytes are provided", async () => {
    await seedOwner("oid-jane");
    const newBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    await updateOwnerCard("oid-jane", { fields: BLANK_FIELDS, photo: newBytes });

    const row = await testPrisma.staffCard.findUnique({ where: { entraObjectId: "oid-jane" } });
    expect(row?.photo && Array.from(row.photo.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  });

  it("clears the photo when null is provided", async () => {
    await seedOwner("oid-jane");

    await updateOwnerCard("oid-jane", { fields: BLANK_FIELDS, photo: null });

    const row = await testPrisma.staffCard.findUnique({ where: { entraObjectId: "oid-jane" } });
    expect(row?.photo).toBeNull();
  });
});
