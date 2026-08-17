import { describe, expect, it } from "vitest";
import { cacheOwnCard, ownCardUrls, OWN_CARD_CACHE } from "./ownCard";

describe("ownCardUrls", () => {
  it("returns the card page, its .vcf, and the QR logo", () => {
    expect(ownCardUrls("jane.tan")).toEqual(["/jane.tan", "/jane.tan.vcf", "/brand/logo.png"]);
  });

  it("builds URLs from the exact slug it is given", () => {
    expect(ownCardUrls("ahmad.zulkifli")[0]).toBe("/ahmad.zulkifli");
  });
});

describe("OWN_CARD_CACHE", () => {
  it("is a stable, versioned bucket name", () => {
    expect(OWN_CARD_CACHE).toBe("own-card-v1");
  });
});

describe("cacheOwnCard", () => {
  it("resolves without throwing when Cache Storage is unavailable", async () => {
    // jsdom has no `caches`; the function must no-op rather than crash the page.
    expect(typeof caches).toBe("undefined");
    await expect(cacheOwnCard("jane.tan")).resolves.toBeUndefined();
  });
});
