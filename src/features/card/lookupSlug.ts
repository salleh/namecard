import { parseSlug } from "./slug";

// Turns whatever a visitor types into the public-card lookup box into a safe
// URL slug, or null when it can't be one. Accepts either a bare local part
// ("jane.tan") or a full email ("jane.tan@example.com") — anything from the
// "@" onward is dropped, then the same `parseSlug` guard that protects the
// public route decides whether the remainder is publishable. Reusing parseSlug
// keeps the charset/length/reserved-word rules in exactly one place.
export function slugFromLookup(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const atIndex = trimmed.indexOf("@");
  const localPart = atIndex === -1 ? trimmed : trimmed.slice(0, atIndex);

  return parseSlug(localPart);
}
