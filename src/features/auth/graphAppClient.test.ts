// graphAppClient.ts is pure (no @/config/env), so the default jsdom environment
// is fine — fetch is stubbed per test. The env-bound token singleton lives in
// graphAppToken.ts and is intentionally not exercised here.
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphRequestError } from "./graphClient";
import {
  createAppGraphTokenProvider,
  deriveTokenUrl,
  fetchGraphPhotoById,
  fetchGraphProfileById,
  GraphTokenError,
  type AppGraphCredentials,
} from "./graphAppClient";

const CREDS: AppGraphCredentials = {
  tokenUrl: "https://login.microsoftonline.com/tenant-guid/oauth2/v2.0/token",
  clientId: "client-guid",
  clientSecret: "super-secret-value",
};

function mockFetchOnce(response: Partial<Response> & { ok: boolean; status: number }): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response as Response));
}

function tokenResponse(accessToken: string, expiresIn = 3600) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ token_type: "Bearer", expires_in: expiresIn, access_token: accessToken }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deriveTokenUrl", () => {
  it("turns a tenant-specific v2.0 issuer into the OAuth2 token endpoint", () => {
    expect(deriveTokenUrl("https://login.microsoftonline.com/abc-123/v2.0")).toBe(
      "https://login.microsoftonline.com/abc-123/oauth2/v2.0/token",
    );
  });

  it("tolerates a trailing slash on the issuer", () => {
    expect(deriveTokenUrl("https://login.microsoftonline.com/abc-123/v2.0/")).toBe(
      "https://login.microsoftonline.com/abc-123/oauth2/v2.0/token",
    );
  });
});

describe("createAppGraphTokenProvider", () => {
  it("requests a client-credentials token with the .default Graph scope", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse("tok-1"));
    vi.stubGlobal("fetch", fetchMock);

    const getToken = createAppGraphTokenProvider(CREDS, { now: () => 0 });
    const token = await getToken();

    expect(token).toBe("tok-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CREDS.tokenUrl);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = String(init.body);
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("scope=https%3A%2F%2Fgraph.microsoft.com%2F.default");
    expect(body).toContain("client_id=client-guid");
  });

  it("caches the token and does not re-request while it is still valid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse("tok-1"));
    vi.stubGlobal("fetch", fetchMock);

    let clock = 0;
    const getToken = createAppGraphTokenProvider(CREDS, { now: () => clock });
    await getToken();
    clock = 1000 * 1000; // well within the 3600s lifetime
    const second = await getToken();

    expect(second).toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-requests a fresh token once the cached one is near expiry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse("tok-1", 3600))
      .mockResolvedValueOnce(tokenResponse("tok-2", 3600));
    vi.stubGlobal("fetch", fetchMock);

    let clock = 0;
    const getToken = createAppGraphTokenProvider(CREDS, { now: () => clock });
    expect(await getToken()).toBe("tok-1");
    clock = 3600 * 1000; // at expiry — inside the refresh-skew window
    expect(await getToken()).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws GraphTokenError on a non-OK token response, without leaking the secret", async () => {
    // Persistent mock: the assertions below each trigger a fresh token request
    // (a failed fetch is never cached), so every call must see the 401.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    const getToken = createAppGraphTokenProvider(CREDS, { now: () => 0 });

    await expect(getToken()).rejects.toThrow(GraphTokenError);
    await expect(getToken()).rejects.toThrow(/401/);
    await expect(getToken()).rejects.not.toThrow(/super-secret-value/);
  });

  it("throws GraphTokenError when a 200 response is missing the access token", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ expires_in: 3600 }) });
    const getToken = createAppGraphTokenProvider(CREDS, { now: () => 0 });

    await expect(getToken()).rejects.toThrow(GraphTokenError);
  });
});

describe("fetchGraphProfileById", () => {
  it("requests /users/{id} with the app token and returns the parsed profile", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "oid-9", displayName: "Aisha Rahman" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const profile = await fetchGraphProfileById("oid-9", "app-token");

    expect(profile.id).toBe("oid-9");
    expect(profile.displayName).toBe("Aisha Rahman");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://graph.microsoft.com/v1.0/users/oid-9");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer app-token");
  });

  it("url-encodes the object id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "x" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await fetchGraphProfileById("a b/c", "app-token");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/users/a%20b%2Fc");
  });

  it("throws GraphRequestError on a non-OK response", async () => {
    mockFetchOnce({ ok: false, status: 403 });

    await expect(fetchGraphProfileById("oid-9", "app-token")).rejects.toThrow(GraphRequestError);
  });

  it("throws when the response body fails schema validation", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ noId: true }) });

    await expect(fetchGraphProfileById("oid-9", "app-token")).rejects.toThrow();
  });
});

describe("fetchGraphPhotoById", () => {
  it("returns photo bytes on success", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    mockFetchOnce({ ok: true, status: 200, arrayBuffer: async () => bytes.buffer });

    expect(await fetchGraphPhotoById("oid-9", "app-token")).toEqual(bytes);
  });

  it("returns null on a 404 (no photo) without warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetchOnce({ ok: false, status: 404 });

    expect(await fetchGraphPhotoById("oid-9", "app-token")).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("returns null and warns (without leaking the token) on a non-404 failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetchOnce({ ok: false, status: 500 });

    expect(await fetchGraphPhotoById("oid-9", "secret-app-token")).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain("500");
    expect(message).not.toContain("secret-app-token");

    warnSpy.mockRestore();
  });
});
