// Normalizes the admin staff-search box input into a safe, case-insensitive
// needle. Bounds the length and strips control characters so the value is safe
// to feed into a Prisma `contains` filter and to echo back into the page.
// Prisma parameterizes the query, so this is normalization (not SQL-injection
// defense), but keeping it clean avoids surprising matches.

export const MAX_SEARCH_LENGTH = 100;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function normalizeAdminSearch(raw: string | null | undefined): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.replace(CONTROL_CHARS, "").trim().toLowerCase().slice(0, MAX_SEARCH_LENGTH);
}
