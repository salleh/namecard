import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetFieldLocks, testPrisma } from "../../../prisma/test/testPrismaClient";
import { getLockedFields, setLockedFields } from "./fieldPolicyRepository";

beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("namecard_test")) {
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL does not target namecard_test (got "${url}").`,
    );
  }
  await resetFieldLocks();
});

afterEach(async () => {
  await resetFieldLocks();
});

afterAll(async () => {
  await testPrisma.$disconnect();
  await prisma.$disconnect();
});

describe("getLockedFields", () => {
  it("returns an empty set when nothing is locked (default policy)", async () => {
    expect(await getLockedFields()).toEqual(new Set());
  });

  it("returns the persisted locked fields", async () => {
    await testPrisma.fieldLock.createMany({
      data: [{ field: "jobTitle" }, { field: "department" }],
    });

    expect(await getLockedFields()).toEqual(new Set(["jobTitle", "department"]));
  });

  it("ignores stored values that are no longer lockable fields", async () => {
    await testPrisma.fieldLock.createMany({ data: [{ field: "jobTitle" }, { field: "retired" }] });

    expect(await getLockedFields()).toEqual(new Set(["jobTitle"]));
  });
});

describe("setLockedFields", () => {
  it("inserts the requested locks", async () => {
    await setLockedFields(["jobTitle", "email"]);

    expect(await getLockedFields()).toEqual(new Set(["jobTitle", "email"]));
  });

  it("reconciles to exactly the desired set — adds new, removes dropped", async () => {
    await setLockedFields(["jobTitle", "department"]);
    await setLockedFields(["department", "website"]);

    expect(await getLockedFields()).toEqual(new Set(["department", "website"]));
  });

  it("clears all locks when given an empty set", async () => {
    await setLockedFields(["jobTitle", "department"]);
    await setLockedFields([]);

    expect(await getLockedFields()).toEqual(new Set());
    expect(await testPrisma.fieldLock.count()).toBe(0);
  });

  it("filters out unknown field names and de-duplicates", async () => {
    await setLockedFields(["jobTitle", "jobTitle", "notAField", "__proto__"]);

    expect(await getLockedFields()).toEqual(new Set(["jobTitle"]));
    expect(await testPrisma.fieldLock.count()).toBe(1);
  });

  it("is idempotent when re-applying the same set", async () => {
    await setLockedFields(["jobTitle", "department"]);
    await setLockedFields(["jobTitle", "department"]);

    expect(await getLockedFields()).toEqual(new Set(["jobTitle", "department"]));
  });
});
