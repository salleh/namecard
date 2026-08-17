// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const globalForPrisma = globalThis as unknown as { prisma?: unknown };

afterEach(() => {
  delete globalForPrisma.prisma;
  vi.resetModules();
});

describe("prisma singleton", () => {
  it("stashes the client on globalThis outside production (dev HMR safety)", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { prisma } = await import("./prisma");

    expect(globalForPrisma.prisma).toBe(prisma);
    vi.unstubAllEnvs();
  });

  it("reuses the globalThis instance across module re-evaluation instead of creating a new client", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const first = await import("./prisma");
    vi.resetModules();
    const second = await import("./prisma");

    expect(second.prisma).toBe(first.prisma);
    vi.unstubAllEnvs();
  });

  it("does not require an existing globalThis.prisma to boot", async () => {
    delete globalForPrisma.prisma;
    vi.stubEnv("NODE_ENV", "development");

    const { prisma } = await import("./prisma");

    expect(prisma).toBeDefined();
    vi.unstubAllEnvs();
  });
});
