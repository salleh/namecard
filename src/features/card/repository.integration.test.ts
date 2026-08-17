import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetStaffCards, testPrisma } from "../../../prisma/test/testPrismaClient";
import { getPublicCardBySlug, getPublicCardPhotoBySlug } from "./repository";

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

async function seedCard(overrides: {
  emailSlug: string;
  activated?: boolean;
  disabled?: boolean;
  displayName?: string;
  photo?: Uint8Array;
}): Promise<void> {
  await testPrisma.staffCard.create({
    data: {
      entraObjectId: `oid-${overrides.emailSlug}`,
      emailSlug: overrides.emailSlug,
      activated: overrides.activated ?? false,
      disabled: overrides.disabled ?? false,
      displayName: overrides.displayName ?? null,
      photo: overrides.photo ? new Uint8Array(overrides.photo) : null,
    },
  });
}

describe("getPublicCardBySlug", () => {
  it("resolves an activated, non-disabled card", async () => {
    await seedCard({ emailSlug: "jane.pub", activated: true, displayName: "Jane Public" });

    const card = await getPublicCardBySlug("jane.pub");

    expect(card?.displayName).toBe("Jane Public");
  });

  it("returns null for a disabled card (leaver)", async () => {
    await seedCard({ emailSlug: "leaver", activated: true, disabled: true });

    expect(await getPublicCardBySlug("leaver")).toBeNull();
  });

  it("returns null for an unactivated card", async () => {
    await seedCard({ emailSlug: "pending", activated: false });

    expect(await getPublicCardBySlug("pending")).toBeNull();
  });

  it("returns null for a nonexistent slug", async () => {
    expect(await getPublicCardBySlug("ghost")).toBeNull();
  });

  it("never exposes internal identifiers", async () => {
    await seedCard({ emailSlug: "safe", activated: true });

    const card = await getPublicCardBySlug("safe");

    expect(card).not.toBeNull();
    expect(card).not.toHaveProperty("id");
    expect(card).not.toHaveProperty("entraObjectId");
    expect(card).not.toHaveProperty("graphSnapshot");
  });

  it("reports hasPhoto and never returns the raw photo bytes", async () => {
    await seedCard({ emailSlug: "withpic", activated: true, photo: PNG_BYTES });
    await seedCard({ emailSlug: "nopic", activated: true });

    const withPic = await getPublicCardBySlug("withpic");
    const noPic = await getPublicCardBySlug("nopic");

    expect(withPic?.hasPhoto).toBe(true);
    expect(withPic).not.toHaveProperty("photo");
    expect(noPic?.hasPhoto).toBe(false);
  });
});

describe("getPublicCardPhotoBySlug", () => {
  it("returns the stored photo bytes for an activated card", async () => {
    await seedCard({ emailSlug: "withpic", activated: true, photo: PNG_BYTES });

    const photo = await getPublicCardPhotoBySlug("withpic");

    expect(photo).not.toBeNull();
    expect(Uint8Array.from(photo!)).toEqual(PNG_BYTES);
  });

  it("returns null when the card has no photo", async () => {
    await seedCard({ emailSlug: "nopic", activated: true });

    expect(await getPublicCardPhotoBySlug("nopic")).toBeNull();
  });

  it("returns null for a disabled card even if it has a photo (activation gate)", async () => {
    await seedCard({ emailSlug: "leaver", activated: true, disabled: true, photo: PNG_BYTES });

    expect(await getPublicCardPhotoBySlug("leaver")).toBeNull();
  });

  it("returns null for an unactivated card even if it has a photo", async () => {
    await seedCard({ emailSlug: "pending", activated: false, photo: PNG_BYTES });

    expect(await getPublicCardPhotoBySlug("pending")).toBeNull();
  });
});
