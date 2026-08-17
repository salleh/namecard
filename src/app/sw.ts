import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { OWN_CARD_CACHE } from "@/features/pwa/ownCard";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Own-card offline support (Step 8). Full-page navigations and .vcf downloads
// go to the network first (so the card is always fresh online — never stale),
// and fall back to OWN_CARD_CACHE only when the network is unavailable. The
// client (cacheOwnCard) is the ONLY writer to that bucket and writes only the
// signed-in user's own URLs, so this never serves — or caches — another staff
// member's card. A request that isn't the owner's card simply isn't in the
// bucket, so it errors offline (out of scope, by design).
const ownCardOfflineFallback = {
  matcher({ request, url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) {
    // NEVER intercept API routes — especially /api/auth/*. The OAuth callback is
    // a navigation, and letting the SW fetch it (on top of the browser's own
    // request) redeems the single-use authorization code twice → the second
    // redemption fails with AADSTS54005 "code already redeemed" and login breaks.
    // Incognito hid this because it disables service workers.
    if (url.pathname.startsWith("/api/")) return false;
    return sameOrigin && (request.mode === "navigate" || url.pathname.endsWith(".vcf"));
  },
  async handler({ request }: { request: Request }): Promise<Response> {
    try {
      return await fetch(request);
    } catch {
      const cache = await caches.open(OWN_CARD_CACHE);
      const cached = await cache.match(request);
      return cached ?? Response.error();
    }
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Disabled: with navigation preload the browser issues the navigation request
  // AND the runtime handler issues its own fetch(request), double-fetching every
  // navigation. Harmless for idempotent GETs, but it redeems the OAuth code
  // twice. Off = one request per navigation.
  navigationPreload: false,
  // Own-card rule first so it wins for navigations/.vcf; defaultCache handles
  // static assets, Next data, images, fonts, etc.
  runtimeCaching: [ownCardOfflineFallback, ...defaultCache],
});

serwist.addEventListeners();
