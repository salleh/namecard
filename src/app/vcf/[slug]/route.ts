import { getPublicCardBySlug, getPublicCardPhotoBySlug } from "@/features/card/repository";
import { parseSlug } from "@/features/card/slug";
import { buildVCard } from "@/features/vcard";

// Prisma requires the Node.js runtime (not Edge).
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Served publicly as `/<email_name>.vcf` (rewritten from that path in
// next.config.ts). Same activation gate as the card page.
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { slug: rawSlug } = await context.params;
  const slug = parseSlug(rawSlug);
  if (!slug) {
    return notFoundResponse();
  }

  const card = await getPublicCardBySlug(slug);
  if (!card) {
    return notFoundResponse();
  }

  // The downloaded file embeds the photo as base64 so it is self-contained —
  // importing it into an address book needs no network round trip (unlike the
  // QR, which references the photo by URL).
  const bytes = card.hasPhoto ? await getPublicCardPhotoBySlug(slug) : null;
  const photo = bytes ? ({ kind: "embed", bytes } as const) : undefined;
  const vcard = buildVCard(card, { photo });
  return new Response(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      // slug is validated to a safe charset, so it is safe in the filename.
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
