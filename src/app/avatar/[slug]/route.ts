import { createHash } from "node:crypto";
import { detectImageContentType } from "@/features/card/imageType";
import { getPublicCardPhotoBySlug } from "@/features/card/repository";
import { parseSlug } from "@/features/card/slug";

// Prisma requires the Node.js runtime (not Edge).
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Photos may be overridden by staff, so let clients cache briefly but revalidate
// against the content ETag afterwards. Matches the `.vcf` route's 5-minute TTL.
const CACHE_CONTROL = "public, max-age=300";

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Serves the staff photo as an image at the public `/avatar/<slug>` path — the
// URL referenced by the vCard `PHOTO;VALUE=URI` property (QR + `.vcf`) and the
// on-page <img>. Behind the same activation gate as the card page: an unknown,
// unactivated, disabled, or photoless slug is a 404 (no placeholder avatar).
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { slug: rawSlug } = await context.params;
  const slug = parseSlug(rawSlug);
  if (!slug) {
    return notFoundResponse();
  }

  const photo = await getPublicCardPhotoBySlug(slug);
  if (!photo) {
    return notFoundResponse();
  }

  const etag = `"${createHash("sha256").update(photo).digest("hex").slice(0, 32)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
    });
  }

  return new Response(new Uint8Array(photo), {
    status: 200,
    headers: {
      "Content-Type": detectImageContentType(photo),
      "Content-Length": String(photo.length),
      "Cache-Control": CACHE_CONTROL,
      ETag: etag,
    },
  });
}
