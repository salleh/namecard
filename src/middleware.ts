import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

// Blunts slug enumeration across the public routes.
export function middleware(request: NextRequest): NextResponse {
  // Prefer the client IP Caddy resolves from its trusted_proxies chain and
  // injects as X-Real-Client-IP (deploy/caddy/Caddyfile) — not spoofable by
  // clients. Fall back to XFF/x-real-ip for local dev (no proxy). NOTE: the
  // upstream DMZ nginx MUST overwrite (not append) client-supplied
  // X-Forwarded-For; verified end-to-end in Steps 9-10.
  const ip =
    request.headers.get("x-real-client-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  if (!rateLimit(ip)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

// Run on public content routes only — skip Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/|brand/|icons/|favicon.ico|manifest.webmanifest|sw.js).*)"],
};
