import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetStaffCards, testPrisma } from "./testPrismaClient";

// Guards against accidentally running these destructive tests against the
// dev/prod database if .env.test is missing or misconfigured.
beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("namecard_test")) {
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL does not target namecard_test (got "${url}"). ` +
        "Check .env.test.",
    );
  }
  // Defensive: a prior crashed run may have left rows before its afterEach fired.
  await resetStaffCards();
});

afterEach(async () => {
  await resetStaffCards();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

function makeCardInput(
  overrides: Partial<Parameters<typeof testPrisma.staffCard.create>[0]["data"]> = {},
) {
  return {
    entraObjectId: "11111111-1111-1111-1111-111111111111",
    emailSlug: "test.user",
    ...overrides,
  };
}

describe("StaffCard model", () => {
  it("rejects a duplicate emailSlug", async () => {
    await testPrisma.staffCard.create({
      data: makeCardInput({ entraObjectId: "aaaaaaaa-0000-0000-0000-000000000001" }),
    });

    await expect(
      testPrisma.staffCard.create({
        data: makeCardInput({ entraObjectId: "aaaaaaaa-0000-0000-0000-000000000002" }),
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate entraObjectId", async () => {
    await testPrisma.staffCard.create({
      data: makeCardInput({ emailSlug: "first.slug" }),
    });

    await expect(
      testPrisma.staffCard.create({
        data: makeCardInput({ emailSlug: "second.slug" }),
      }),
    ).rejects.toThrow();
  });

  it("defaults activated and disabled to false on create", async () => {
    const card = await testPrisma.staffCard.create({ data: makeCardInput() });

    expect(card.activated).toBe(false);
    expect(card.disabled).toBe(false);
  });

  it("round-trips a Bytes photo", async () => {
    const photo = Buffer.from("fake-image-bytes", "utf-8");
    const created = await testPrisma.staffCard.create({
      data: makeCardInput({ photo }),
    });

    const found = await testPrisma.staffCard.findUniqueOrThrow({ where: { id: created.id } });

    expect(Buffer.from(found.photo ?? []).equals(photo)).toBe(true);
  });

  it("returns null for photo when not set", async () => {
    const created = await testPrisma.staffCard.create({ data: makeCardInput() });

    expect(created.photo).toBeNull();
  });

  it("round-trips a Json graphSnapshot", async () => {
    const graphSnapshot = {
      displayName: "Jane Tan",
      jobTitle: "Marketing Executive",
      nested: { officeLocation: "HQ", tags: ["staff", "marketing"] },
    };
    const created = await testPrisma.staffCard.create({
      data: makeCardInput({ graphSnapshot }),
    });

    const found = await testPrisma.staffCard.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.graphSnapshot).toEqual(graphSnapshot);
  });

  it("returns null for graphSnapshot when not set", async () => {
    const created = await testPrisma.staffCard.create({ data: makeCardInput() });

    expect(created.graphSnapshot).toBeNull();
  });
});
