import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetStaffCards, testPrisma } from "../../../prisma/test/testPrismaClient";
import {
  getEntraObjectIdBySlug,
  getStaffCardForEdit,
  listStaffCards,
  setCardDisabled,
  updateStaffCardByAdmin,
} from "./adminRepository";

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

interface SeedOptions {
  slug: string;
  activated?: boolean;
  disabled?: boolean;
  displayName?: string;
  department?: string;
  email?: string;
}

async function seed(opts: SeedOptions): Promise<void> {
  await testPrisma.staffCard.create({
    data: {
      entraObjectId: `oid-${opts.slug}`,
      emailSlug: opts.slug,
      activated: opts.activated ?? true,
      disabled: opts.disabled ?? false,
      displayName: opts.displayName ?? opts.slug,
      department: opts.department ?? null,
      email: opts.email ?? `${opts.slug}@example.com`,
    },
  });
}

describe("listStaffCards", () => {
  it("returns activated cards (including disabled ones) ordered by name", async () => {
    await seed({ slug: "zoe.wong", displayName: "Zoe Wong" });
    await seed({ slug: "amir.hassan", displayName: "Amir Hassan", disabled: true });

    const rows = await listStaffCards("");

    expect(rows.map((r) => r.emailSlug)).toEqual(["amir.hassan", "zoe.wong"]);
    expect(rows.find((r) => r.emailSlug === "amir.hassan")?.disabled).toBe(true);
  });

  it("excludes unactivated cards", async () => {
    await seed({ slug: "pending.user", activated: false });

    expect(await listStaffCards("")).toHaveLength(0);
  });

  it("filters case-insensitively across name, slug, email, and department", async () => {
    await seed({ slug: "jane.tan", displayName: "Jane Tan", department: "Marketing" });
    await seed({ slug: "ahmad.zulkifli", displayName: "Ahmad Zulkifli", department: "Sales" });

    expect((await listStaffCards("marketing")).map((r) => r.emailSlug)).toEqual(["jane.tan"]);
    expect((await listStaffCards("AHMAD")).map((r) => r.emailSlug)).toEqual(["ahmad.zulkifli"]);
    expect((await listStaffCards("example.com")).length).toBe(2);
  });

  it("never exposes internal identifiers", async () => {
    await seed({ slug: "jane.tan" });

    const [row] = await listStaffCards("");

    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("entraObjectId");
    expect(row).not.toHaveProperty("graphSnapshot");
    expect(row).not.toHaveProperty("photo");
  });
});

describe("setCardDisabled", () => {
  it("disables a card by slug and returns the changed-row count", async () => {
    await seed({ slug: "leaver", disabled: false });

    const count = await setCardDisabled("leaver", true);

    expect(count).toBe(1);
    const row = await testPrisma.staffCard.findUnique({ where: { emailSlug: "leaver" } });
    expect(row?.disabled).toBe(true);
  });

  it("re-enables a disabled card", async () => {
    await seed({ slug: "returner", disabled: true });

    await setCardDisabled("returner", false);

    const row = await testPrisma.staffCard.findUnique({ where: { emailSlug: "returner" } });
    expect(row?.disabled).toBe(false);
  });

  it("returns 0 for an unknown slug and changes nothing else", async () => {
    await seed({ slug: "jane.tan", disabled: false });

    const count = await setCardDisabled("ghost", true);

    expect(count).toBe(0);
    const row = await testPrisma.staffCard.findUnique({ where: { emailSlug: "jane.tan" } });
    expect(row?.disabled).toBe(false);
  });
});

describe("getStaffCardForEdit", () => {
  it("returns the editable fields for a card, without internal identifiers or bytes", async () => {
    await seed({ slug: "jane.tan", displayName: "Jane Tan", department: "Marketing" });

    const card = await getStaffCardForEdit("jane.tan");

    expect(card?.emailSlug).toBe("jane.tan");
    expect(card?.displayName).toBe("Jane Tan");
    expect(card?.department).toBe("Marketing");
    expect(card?.hasPhoto).toBe(false);
    expect(card).not.toHaveProperty("entraObjectId");
    expect(card).not.toHaveProperty("id");
    expect(card).not.toHaveProperty("photo");
  });

  it("returns disabled cards too (admin may edit any existing card)", async () => {
    await seed({ slug: "amir.hassan", disabled: true });

    const card = await getStaffCardForEdit("amir.hassan");

    expect(card?.disabled).toBe(true);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getStaffCardForEdit("ghost")).toBeNull();
  });
});

describe("getEntraObjectIdBySlug", () => {
  it("resolves an existing slug to its Entra object id", async () => {
    await seed({ slug: "jane.tan" });

    expect(await getEntraObjectIdBySlug("jane.tan")).toBe("oid-jane.tan");
  });

  it("returns null for an unknown slug (the M365-fetch containment gate)", async () => {
    expect(await getEntraObjectIdBySlug("not-a-staff-member")).toBeNull();
  });
});

describe("updateStaffCardByAdmin", () => {
  it("writes editable fields by slug and returns the changed-row count", async () => {
    await seed({ slug: "jane.tan", displayName: "Jane Tan" });

    const count = await updateStaffCardByAdmin("jane.tan", {
      fields: { displayName: "Jane T.", jobTitle: "Manager" },
    });

    expect(count).toBe(1);
    const row = await testPrisma.staffCard.findUnique({ where: { emailSlug: "jane.tan" } });
    expect(row?.displayName).toBe("Jane T.");
    expect(row?.jobTitle).toBe("Manager");
  });

  it("never changes emailSlug, entraObjectId, activated, or disabled", async () => {
    await seed({ slug: "jane.tan", disabled: false });

    await updateStaffCardByAdmin("jane.tan", { fields: { displayName: "X" } });

    const row = await testPrisma.staffCard.findUnique({ where: { emailSlug: "jane.tan" } });
    expect(row?.emailSlug).toBe("jane.tan");
    expect(row?.entraObjectId).toBe("oid-jane.tan");
    expect(row?.activated).toBe(true);
    expect(row?.disabled).toBe(false);
  });

  it("clears the photo when photo: null is passed", async () => {
    await testPrisma.staffCard.create({
      data: {
        entraObjectId: "oid-withphoto",
        emailSlug: "withphoto",
        activated: true,
        photo: new Uint8Array([1, 2, 3]),
      },
    });

    await updateStaffCardByAdmin("withphoto", { fields: {}, photo: null });

    const row = await testPrisma.staffCard.findUnique({ where: { emailSlug: "withphoto" } });
    expect(row?.photo).toBeNull();
  });

  it("returns 0 for an unknown slug and writes nothing", async () => {
    const count = await updateStaffCardByAdmin("ghost", { fields: { displayName: "X" } });

    expect(count).toBe(0);
  });
});
