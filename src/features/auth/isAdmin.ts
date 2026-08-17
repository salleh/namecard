// Approach A admin gate (docs/deploy/entra-app-registration.md §7): admin
// membership is decided purely by whether the configured ADMIN_GROUP_ID
// appears in the token's `groups` claim — no extra Graph call, no stored
// role in the DB. `adminGroupId` is threaded in as a parameter (not read
// from env directly) so this stays a pure, trivially testable function.
export function computeIsAdmin(
  groups: readonly string[],
  adminGroupId: string | undefined,
): boolean {
  if (!adminGroupId) {
    return false;
  }
  return groups.includes(adminGroupId);
}
