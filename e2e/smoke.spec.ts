import { expect, test } from "@playwright/test";
import { orgConfig } from "../customization/org";

test("home page returns 200", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: orgConfig.appName })).toBeVisible();
});

test("web app manifest is served", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.name).toBe(orgConfig.appName);
});
