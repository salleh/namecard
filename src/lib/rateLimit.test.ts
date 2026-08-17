import { afterEach, describe, expect, it } from "vitest";
import { __rateLimitSize, __resetRateLimitState, rateLimit } from "./rateLimit";

afterEach(() => __resetRateLimitState());

describe("rateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    const start = 1_000_000;
    for (let i = 0; i < 60; i += 1) {
      expect(rateLimit("1.2.3.4", start)).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const start = 1_000_000;
    for (let i = 0; i < 60; i += 1) {
      rateLimit("1.2.3.4", start);
    }
    expect(rateLimit("1.2.3.4", start)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const start = 1_000_000;
    for (let i = 0; i < 60; i += 1) {
      rateLimit("1.2.3.4", start);
    }
    expect(rateLimit("1.2.3.4", start)).toBe(false);
    expect(rateLimit("1.2.3.4", start + 60_000)).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const start = 1_000_000;
    for (let i = 0; i < 60; i += 1) {
      rateLimit("1.1.1.1", start);
    }
    expect(rateLimit("1.1.1.1", start)).toBe(false);
    expect(rateLimit("2.2.2.2", start)).toBe(true);
  });

  it("enforces a hard cap on tracked keys even when all are active (C-1)", () => {
    const now = 5_000_000;
    for (let i = 0; i < 10_200; i += 1) {
      rateLimit(`key-${i}`, now); // same window => none expired
    }
    expect(__rateLimitSize()).toBeLessThanOrEqual(10_000);
  });
});
