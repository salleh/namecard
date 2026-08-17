// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

describe("env module client-side guard", () => {
  it("throws when imported in a browser-like environment", async () => {
    await expect(import("./env")).rejects.toThrow(/must not be imported in client code/);
  });
});
