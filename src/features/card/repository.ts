import { prisma } from "@/lib/prisma";

// Shared activation gate for public resolution (CLAUDE.md "Access Rules"):
// resolve a card ONLY when it is activated and not disabled. Both the card
// lookup and the photo lookup use it, so the enumeration/leaver defense can
// never drift between them.
function publicCardWhere(emailSlug: string) {
  return { emailSlug, activated: true, disabled: false };
}

// Only the fields safe to render/serialize publicly. Deliberately omits the
// internal id, entraObjectId, and graphSnapshot (CLAUDE.md: no internal staff
// identifiers in public markup/payloads). The photo is exposed as a `hasPhoto`
// boolean rather than raw bytes — the image itself is fetched by URL from the
// `/avatar/<slug>` endpoint (see `getPublicCardPhotoBySlug`), so the page render
// and vCard build never carry the (potentially large) image payload.
export interface PublicCard {
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  email: string | null;
  businessPhone: string | null;
  mobilePhone: string | null;
  faxNumber: string | null;
  officeLocation: string | null;
  address: string | null;
  website: string | null;
  hasPhoto: boolean;
}

// Resolves a card ONLY when it is activated and not disabled — otherwise null
// (the caller renders a 404). This activation gate is the enumeration defense
// for guessable email-based slugs.
//
// `hasPhoto` is derived from a cheap `count` (photo IS NOT NULL) rather than by
// selecting the `photo` column: the bytea can be up to MAX_PHOTO_BYTES, and the
// page only needs a boolean to decide whether to render `<img src="/avatar/…">`.
// The image bytes are transferred exactly once — by the browser, from the
// `/avatar` endpoint — instead of also being read here and discarded.
export async function getPublicCardBySlug(emailSlug: string): Promise<PublicCard | null> {
  const where = publicCardWhere(emailSlug);
  const [row, photoCount] = await Promise.all([
    prisma.staffCard.findFirst({
      where,
      select: {
        displayName: true,
        givenName: true,
        surname: true,
        jobTitle: true,
        department: true,
        company: true,
        email: true,
        businessPhone: true,
        mobilePhone: true,
        faxNumber: true,
        officeLocation: true,
        address: true,
        website: true,
      },
    }),
    // Photos are always stored non-empty (photoUpload rejects anything without a
    // real image signature; Graph returns null for "no photo"), so "not null" is
    // equivalent to the `length > 0` check getPublicCardPhotoBySlug applies.
    prisma.staffCard.count({ where: { ...where, photo: { not: null } } }),
  ]);

  if (!row) {
    return null;
  }

  return { ...row, hasPhoto: photoCount > 0 };
}

// Raw photo bytes for the public `/avatar/<slug>` endpoint, behind the SAME
// activation gate as the card page — a disabled/unactivated card's photo must
// not resolve. Returns null when the card is not publicly resolvable or carries
// no photo (the endpoint renders a 404 in that case).
export async function getPublicCardPhotoBySlug(emailSlug: string): Promise<Uint8Array | null> {
  const row = await prisma.staffCard.findFirst({
    where: publicCardWhere(emailSlug),
    select: { photo: true },
  });

  const photo = row?.photo;
  return photo != null && photo.length > 0 ? photo : null;
}
