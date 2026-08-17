// Public URL slug guard. The slug is the lowercased local part of a staff email.
// Validating + normalizing here is the enumeration/injection defense for the
// public routes (CLAUDE.md "Access Rules"): anything that isn't a well-formed
// slug is rejected before it ever reaches the database or a filename.
const MAX_SLUG_LENGTH = 64;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/;

// Names that collide with real or planned static routes (/me, /api, /admin,
// /vcf, /avatar, framework paths). A staff member whose email local part matches
// one of these would otherwise be silently shadowed by the static route.
const RESERVED_SLUGS = new Set([
  "me",
  "api",
  "admin",
  "vcf",
  "avatar",
  "_next",
  "favicon",
  "manifest",
  "sw",
  "brand",
  "icons",
]);

export function parseSlug(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > MAX_SLUG_LENGTH) {
    return null;
  }
  if (!SLUG_PATTERN.test(normalized) || RESERVED_SLUGS.has(normalized)) {
    return null;
  }
  return normalized;
}
