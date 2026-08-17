// Extracts the `groups` claim from the raw OIDC profile (the ID token claims
// Auth.js passes to the `jwt` callback on sign-in). Entra app-registration
// Approach A (docs/deploy/entra-app-registration.md §7) emits this claim only
// when the "groups optional claim" is configured AND the admin security
// group is assigned to the app — until then the claim is simply absent.
// Treat "absent/malformed" as "not an admin" (fail closed, non-blocking):
// login must never fail just because the groups claim isn't configured yet.
export function extractGroupsClaim(profile: unknown): string[] {
  if (typeof profile !== "object" || profile === null) {
    return [];
  }

  const candidate = (profile as Record<string, unknown>).groups;
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter((value): value is string => typeof value === "string");
}
