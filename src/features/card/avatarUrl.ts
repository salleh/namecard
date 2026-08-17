// Absolute URL to the public avatar endpoint (`/avatar/<slug>`) for a staff
// card. The vCard `PHOTO;VALUE=URI` property must be an absolute URI — a phone
// scanning the QR resolves it with no base to fall back on — so callers pass the
// canonical public origin, `env.AUTH_URL` (the `/me` preview receives it as a
// server-provided prop rather than reading `window`). A trailing slash is tolerated.
export function avatarUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/avatar/${slug}`;
}
