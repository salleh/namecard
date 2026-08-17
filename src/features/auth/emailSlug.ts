import { parseSlug } from "@/features/card/slug";
import type { GraphMeResponse } from "./graphProfile";

// Derives the public URL slug from a Graph /me snapshot: the lowercased local
// part of `mail` (falling back to `userPrincipalName` when `mail` is unset —
// CLAUDE.md: "derived from the Entra `mail` attribute" is the common case,
// but some accounts only carry a UPN). Reuses `parseSlug` (features/card) so
// the same length/charset/reserved-word rules that gate the public route
// also gate what we're willing to write into `emailSlug` — a value this
// function accepts is guaranteed publishable.
export function deriveEmailSlug(
  profile: Pick<GraphMeResponse, "mail" | "userPrincipalName">,
): string | null {
  const source = profile.mail ?? profile.userPrincipalName;
  if (!source) {
    return null;
  }

  const atIndex = source.indexOf("@");
  if (atIndex <= 0) {
    // No '@', or an empty local part (e.g. "@example.com") — not a usable slug.
    return null;
  }

  return parseSlug(source.slice(0, atIndex));
}
