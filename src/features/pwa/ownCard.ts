// Offline caching of the signed-in user's OWN card only (CLAUDE.md Step 8:
// "cache the logged-in user's own card + QR for offline display"; non-goal:
// "No caching other users' cards"). The client precaches these URLs into a
// dedicated Cache Storage bucket; the service worker (src/app/sw.ts) serves
// from this same bucket as an offline fallback for navigations/.vcf. Because
// only the owner's URLs are ever written here, no other staff card is cached.

// Versioned so a format change can invalidate the whole bucket by bumping it.
export const OWN_CARD_CACHE = "own-card-v1";

// The centered QR logo — needed so the client-rendered QR still draws offline.
const LOGO_URL = "/brand/logo.png";

// The exact set of URLs that make the owner's card + QR work offline:
// the public card page, its .vcf download, and the QR overlay logo.
export function ownCardUrls(slug: string): string[] {
  return [`/${slug}`, `/${slug}.vcf`, LOGO_URL];
}

// Best-effort precache of the owner's card into OWN_CARD_CACHE. Safe to call in
// any environment: it no-ops when Cache Storage is unavailable (SSR, older
// browsers), and a single failing asset never rejects the whole operation.
// Re-calling it (e.g. after a save) refetches and overwrites, which is the
// cache-invalidation path for edits.
export async function cacheOwnCard(slug: string): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }
  try {
    const cache = await caches.open(OWN_CARD_CACHE);
    await Promise.all(
      ownCardUrls(slug).map(async (url) => {
        try {
          // `reload` bypasses the HTTP cache so a post-edit refresh stores the
          // current card, not a stale copy.
          const response = await fetch(url, { cache: "reload" });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch {
          // One asset failing (offline, transient) must not abort the rest.
        }
      }),
    );
  } catch {
    // Cache Storage unavailable/blocked — offline support is a nicety, not a
    // hard requirement, so failing silently is acceptable here.
  }
}
