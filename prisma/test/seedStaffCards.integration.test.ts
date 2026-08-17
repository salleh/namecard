import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { STAFF_CARD_FIXTURES } from "../fixtures/staffCard";
import { seedStaffCards } from "../seedStaffCards";
import { resetStaffCards, testPrisma } from "./testPrismaClient";

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

describe("seedStaffCards", () => {
  it("creates one row per fixture", async () => {
    await seedStaffCards(testPrisma);

    const count = await testPrisma.staffCard.count();
    expect(count).toBe(STAFF_CARD_FIXTURES.length);
  });

  it("seeds at least one activated and one disabled card", async () => {
    await seedStaffCards(testPrisma);

    const activatedCount = await testPrisma.staffCard.count({ where: { activated: true } });
    const disabledCount = await testPrisma.staffCard.count({ where: { disabled: true } });

    expect(activatedCount).toBeGreaterThanOrEqual(1);
    expect(disabledCount).toBeGreaterThanOrEqual(1);
  });

  it("is idempotent: running twice yields the same row count", async () => {
    await seedStaffCards(testPrisma);
    const firstCount = await testPrisma.staffCard.count();

    await seedStaffCards(testPrisma);
    const secondCount = await testPrisma.staffCard.count();

    expect(secondCount).toBe(firstCount);
    expect(secondCount).toBe(STAFF_CARD_FIXTURES.length);
  });

  it("updates existing rows in place (exercises the upsert UPDATE branch)", async () => {
    const fixture = STAFF_CARD_FIXTURES[0];
    if (!fixture) throw new Error("expected at least one fixture");

    // Pre-create the row under the same entraObjectId but with a stale name, so
    // re-seeding must take the upsert UPDATE branch (not a no-op on conflict).
    await testPrisma.staffCard.create({
      data: {
        entraObjectId: fixture.entraObjectId,
        emailSlug: fixture.emailSlug,
        displayName: "STALE NAME",
      },
    });

    await seedStaffCards(testPrisma);

    const row = await testPrisma.staffCard.findUniqueOrThrow({
      where: { entraObjectId: fixture.entraObjectId },
    });
    expect(row.displayName).toBe(fixture.displayName);

    // ...and still no duplicate rows.
    expect(await testPrisma.staffCard.count()).toBe(STAFF_CARD_FIXTURES.length);
  });
});
