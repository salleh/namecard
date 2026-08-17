import { z } from "zod";
import { GRAPH_PROFILE_SELECT, GraphRequestError } from "./graphClient";
import { graphMeResponseSchema, type GraphMeResponse } from "./graphProfile";

// App-only (client-credentials) Microsoft Graph access. Unlike graphClient.ts —
// which uses the delegated `/me` token available only during sign-in — this
// module lets the app read ANY staff member's directory profile by Entra object
// id at any time, using the app's own identity. It powers the on-demand
// "refresh from M365" features (employee self-refresh and admin per-employee
// edit) that the login-time snapshot cannot serve.
//
// Requires the `User.Read.All` APPLICATION permission with admin consent on the
// Entra app registration (see docs/deploy/entra-app-registration.md). Read-only:
// never writes back to Entra (CLAUDE.md "Non-Goals").

// Client-credentials asks for the app's statically-consented permissions via the
// `.default` scope (not per-call scopes).
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

// Refresh slightly before the real expiry so a token can't lapse mid-request.
const EXPIRY_SKEW_MS = 60_000;

const GRAPH_USERS_BASE = "https://graph.microsoft.com/v1.0/users";

// Token endpoint response — only the two fields we depend on are required.
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
});

export class GraphTokenError extends Error {
  constructor(
    public readonly status: number,
    detail = "request failed",
  ) {
    // Message carries only the status + a generic detail — never the client
    // secret or the token itself.
    super(`Microsoft Graph app-only token ${detail} (status ${status})`);
    this.name = "GraphTokenError";
  }
}

// Derive the OAuth2 token endpoint from the tenant-specific OIDC issuer
// (`…/{tenantId}/v2.0` → `…/{tenantId}/oauth2/v2.0/token`), so the tenant is
// configured in exactly one place (AUTH_MICROSOFT_ENTRA_ID_ISSUER) rather than
// duplicated in a second env var.
export function deriveTokenUrl(issuer: string): string {
  const base = issuer.replace(/\/v2\.0\/?$/i, "").replace(/\/$/, "");
  return `${base}/oauth2/v2.0/token`;
}

export interface AppGraphCredentials {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

// Injectable clock keeps the cache/expiry logic testable without real time.
export interface AppGraphTokenDeps {
  now: () => number;
}

// Builds a cached client-credentials token provider. The returned function
// acquires an app-only Graph token lazily and reuses it until it nears expiry,
// so a burst of refresh requests shares a single token fetch.
export function createAppGraphTokenProvider(
  creds: AppGraphCredentials,
  deps: AppGraphTokenDeps = { now: () => Date.now() },
): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;

  return async function getToken(): Promise<string> {
    const now = deps.now();
    if (cached && cached.expiresAt - EXPIRY_SKEW_MS > now) {
      return cached.token;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: GRAPH_SCOPE,
    });

    const response = await fetch(creds.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new GraphTokenError(response.status);
    }

    const parsed = tokenResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new GraphTokenError(response.status, "response was malformed");
    }

    cached = {
      token: parsed.data.access_token,
      expiresAt: now + parsed.data.expires_in * 1000,
    };
    return cached.token;
  };
}

// Reads a staff member's directory profile by Entra object id via the app-only
// token. Mirrors graphClient.fetchGraphProfile but targets `/users/{id}` and
// validates against the same shared schema. Throws GraphRequestError on a
// non-OK response so callers can surface a clean failure.
export async function fetchGraphProfileById(
  entraObjectId: string,
  accessToken: string,
): Promise<GraphMeResponse> {
  const url = `${GRAPH_USERS_BASE}/${encodeURIComponent(entraObjectId)}?$select=${GRAPH_PROFILE_SELECT}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GraphRequestError(`/users/${entraObjectId}`, response.status);
  }

  const body: unknown = await response.json();
  return graphMeResponseSchema.parse(body);
}

// Reads a staff member's photo by Entra object id. Same "photo is optional"
// semantics as graphClient.fetchGraphPhoto: 404 → null (no photo), any other
// non-OK → null plus a status-only warning (never logs the token). Lets the
// refresh flow proceed without a photo rather than failing the whole fetch.
export async function fetchGraphPhotoById(
  entraObjectId: string,
  accessToken: string,
): Promise<Uint8Array | null> {
  const url = `${GRAPH_USERS_BASE}/${encodeURIComponent(entraObjectId)}/photo/$value`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(
        `auth: Microsoft Graph /users photo request failed with status ${response.status}`,
      );
    }
    return null;
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
