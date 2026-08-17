import { graphMeResponseSchema, type GraphMeResponse } from "./graphProfile";

// $select keeps the response to exactly the fields graphProfile.ts maps —
// least-privilege data pull (CLAUDE.md "Authentication & Data Flow"). Exported
// so the app-only client (graphAppClient.ts) selects the identical field set
// when reading a profile by id (`/users/{id}`) — one source of truth for both.
export const GRAPH_PROFILE_SELECT =
  "id,displayName,givenName,surname,jobTitle,department,companyName,mail,userPrincipalName,businessPhones,mobilePhone,faxNumber,officeLocation,streetAddress,city,state,postalCode,country";
const GRAPH_ME_URL = `https://graph.microsoft.com/v1.0/me?$select=${GRAPH_PROFILE_SELECT}`;
const GRAPH_PHOTO_URL = "https://graph.microsoft.com/v1.0/me/photo/$value";

export class GraphRequestError extends Error {
  constructor(
    resource: string,
    public readonly status: number,
  ) {
    super(`Microsoft Graph ${resource} request failed with status ${status}`);
    this.name = "GraphRequestError";
  }
}

// Delegated User.Read call — read-only, never writes back to Entra
// (CLAUDE.md "Non-Goals"). Validates the response against the shared zod
// schema so a malformed/unexpected Graph payload fails loudly instead of
// silently corrupting a StaffCard row.
export async function fetchGraphProfile(accessToken: string): Promise<GraphMeResponse> {
  const response = await fetch(GRAPH_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GraphRequestError("/me", response.status);
  }

  const body: unknown = await response.json();
  return graphMeResponseSchema.parse(body);
}

// The photo is genuinely optional — many staff have none, which Graph
// reports as a 404. Any other non-OK response is also treated as "no
// photo" rather than failing the whole login: per the Step-5 spec, a photo
// fetch problem must never block sign-in. A non-404 failure (401/403/500/…)
// is still worth a warning though — it can indicate a systemic Graph/token
// problem rather than "this particular staff member has no photo", so it
// shouldn't be silently indistinguishable from the expected case. Never
// logs the access token.
export async function fetchGraphPhoto(accessToken: string): Promise<Uint8Array | null> {
  const response = await fetch(GRAPH_PHOTO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(`auth: Microsoft Graph /me/photo request failed with status ${response.status}`);
    }
    return null;
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
