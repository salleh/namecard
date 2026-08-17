// Feature: auth — Auth.js Entra OIDC flow, Graph prefill on first login,
// admin security-group claim extraction. Step 5.
export { deriveEmailSlug } from "./emailSlug";
export { fetchGraphPhoto, fetchGraphProfile, GraphRequestError } from "./graphClient";
// Pure app-only Graph client only. The env-bound token singleton lives in
// ./graphAppToken and is imported directly by server code — keeping it out of
// this barrel stops `@/config/env` leaking into client bundles / jsdom tests.
export {
  createAppGraphTokenProvider,
  deriveTokenUrl,
  fetchGraphPhotoById,
  fetchGraphProfileById,
  GraphTokenError,
  type AppGraphCredentials,
} from "./graphAppClient";
export {
  graphMeResponseSchema,
  mapGraphProfileToVCardFields,
  type GraphMeResponse,
  type StaffCardVCardFields,
} from "./graphProfile";
export { extractGroupsClaim } from "./groupsClaim";
export { computeIsAdmin } from "./isAdmin";
export {
  buildSessionToken,
  type BuildSessionTokenParams,
  type StaffCardTokenFields,
} from "./sessionToken";
export {
  EmailSlugCollisionError,
  MissingEmailSlugError,
  upsertStaffCardFromGraph,
} from "./upsertStaffCard";
