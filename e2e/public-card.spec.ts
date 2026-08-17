import { expect, test } from "@playwright/test";

// Step 10 — critical public journey + hardening (unauthenticated).
//
// PREREQUISITES: the dev app (`npm run dev`, started by playwright.config.ts)
// must point at a database seeded with the standard fixtures
// (`npm run db:seed` → prisma/fixtures/staffCard.ts):
//   - jane.tan        — activated, not disabled  → resolves
//   - ahmad.zulkifli  — activated BUT disabled    → 404 (leaver gate)
// The authenticated journeys (/me edit, admin disable) are validated manually
// during UAT — they need an Entra session and are out of scope here.

const ACTIVE_SLUG = "jane.tan";
const DISABLED_SLUG = "ahmad.zulkifli";
const UNKNOWN_SLUG = "nobody.here";

// Internal identifiers that must NEVER appear in public markup or payloads
// (CLAUDE.md "no internal staff IDs anywhere"). This is the seeded entraObjectId
// for jane.tan — its absence proves the object id isn't leaking into the page/vcf.
const SEEDED_ENTRA_OBJECT_ID = "00000000-0000-0000-0000-000000000001";

test.describe("public card page", () => {
  test("renders details, QR, and a download link for an activated card", async ({ page }) => {
    const res = await page.goto(`/${ACTIVE_SLUG}`);
    expect(res?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Jane Tan" })).toBeVisible();
    await expect(page.getByText("Marketing Executive")).toBeVisible();
    await expect(page.getByRole("img", { name: /scan to add this contact/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /download contact/i })).toBeVisible();
  });

  test("does not leak the internal Entra object id into the page markup", async ({ page }) => {
    await page.goto(`/${ACTIVE_SLUG}`);
    expect(await page.content()).not.toContain(SEEDED_ENTRA_OBJECT_ID);
  });

  test("404s a disabled (leaver) card", async ({ page }) => {
    const res = await page.goto(`/${DISABLED_SLUG}`);
    expect(res?.status()).toBe(404);
  });

  test("404s an unknown slug", async ({ page }) => {
    const res = await page.goto(`/${UNKNOWN_SLUG}`);
    expect(res?.status()).toBe(404);
  });
});

test.describe(".vcf download", () => {
  test("serves a valid vCard for an activated card, with no internal id", async ({ request }) => {
    const res = await request.get(`/${ACTIVE_SLUG}.vcf`);

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/vcard");
    expect(res.headers()["content-disposition"]).toContain(`filename="${ACTIVE_SLUG}.vcf"`);

    const body = await res.text();
    expect(body).toContain("BEGIN:VCARD");
    expect(body).toContain("VERSION:3.0");
    expect(body).toContain("FN:Jane Tan");
    expect(body).toContain("ORG:Example Org;Marketing");
    expect(body).not.toContain(SEEDED_ENTRA_OBJECT_ID);
  });

  test("404s the .vcf for a disabled card", async ({ request }) => {
    expect((await request.get(`/${DISABLED_SLUG}.vcf`)).status()).toBe(404);
  });

  test("404s the .vcf for an unknown slug", async ({ request }) => {
    expect((await request.get(`/${UNKNOWN_SLUG}.vcf`)).status()).toBe(404);
  });
});

test.describe("avatar endpoint gate", () => {
  // The fixtures carry no photo, so an activated card's avatar 404s (no
  // placeholder), and a disabled/unknown slug 404s behind the activation gate.
  test("404s when the card has no photo", async ({ request }) => {
    expect((await request.get(`/avatar/${ACTIVE_SLUG}`)).status()).toBe(404);
  });

  test("404s for a disabled card", async ({ request }) => {
    expect((await request.get(`/avatar/${DISABLED_SLUG}`)).status()).toBe(404);
  });

  test("404s for an unknown slug", async ({ request }) => {
    expect((await request.get(`/avatar/${UNKNOWN_SLUG}`)).status()).toBe(404);
  });
});
