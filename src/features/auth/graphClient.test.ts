import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphRequestError, fetchGraphPhoto, fetchGraphProfile } from "./graphClient";

function mockFetchOnce(response: Partial<Response> & { ok: boolean; status: number }): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response as Response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchGraphProfile", () => {
  it("returns the parsed profile on success", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "oid-1", displayName: "Jane Tan" }),
    });

    const profile = await fetchGraphProfile("token-abc");

    expect(profile.id).toBe("oid-1");
    expect(profile.displayName).toBe("Jane Tan");
  });

  it("sends the access token as a Bearer authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "oid-1" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await fetchGraphProfile("token-abc");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://graph.microsoft.com/v1.0/me");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
  });

  it("throws GraphRequestError on a non-OK response", async () => {
    mockFetchOnce({ ok: false, status: 401 });

    await expect(fetchGraphProfile("token-abc")).rejects.toThrow(GraphRequestError);
  });

  it("throws when the response body fails schema validation", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ noId: true }) });

    await expect(fetchGraphProfile("token-abc")).rejects.toThrow();
  });
});

describe("fetchGraphPhoto", () => {
  it("returns photo bytes on success", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    mockFetchOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer,
    });

    const photo = await fetchGraphPhoto("token-abc");

    expect(photo).toEqual(bytes);
  });

  it("returns null on a 404 (staff member has no photo) without warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetchOnce({ ok: false, status: 404 });

    expect(await fetchGraphPhoto("token-abc")).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("returns null on any other non-OK response rather than throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetchOnce({ ok: false, status: 500 });

    expect(await fetchGraphPhoto("token-abc")).toBeNull();

    warnSpy.mockRestore();
  });

  it("warns (without leaking the access token) on a non-404 failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetchOnce({ ok: false, status: 500 });

    await fetchGraphPhoto("super-secret-token");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain("500");
    expect(message).not.toContain("super-secret-token");

    warnSpy.mockRestore();
  });
});
