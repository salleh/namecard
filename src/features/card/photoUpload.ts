// Validates a staff-uploaded profile photo from the `/me` editor before it is
// persisted as `StaffCard.photo` (bytea). Photos are served by the public
// `/avatar/<slug>` endpoint (on-page <img> + the QR's `PHOTO;VALUE=URI`) and
// inlined as base64 in the `.vcf` download. Two defenses matter here:
//   1. Size cap — bounds a single row, the served image, and the `.vcf` payload.
//   2. Magic-byte sniff — trust the actual leading bytes, NOT the client's
//      declared Content-Type (which is trivially spoofable), so only real
//      PNG/JPEG/GIF images are ever stored. Mirrors the formats the avatar
//      endpoint's sniffer (src/features/card/imageType.ts) understands.
//
// Known limitation (accepted): the bytes are stored verbatim — not re-encoded —
// so a "polyglot" file (valid image header + trailing arbitrary bytes) and any
// EXIF/GPS metadata survive. This stays safe even though `/avatar/<slug>` serves
// the raw bytes: the Content-Type is derived from our own magic-byte sniff (never
// the client's), the app sets `X-Content-Type-Options: nosniff` globally
// (next.config.ts), and only raster formats are accepted (no SVG), so there is no
// stored content-sniffing/active-content XSS path. Re-encoding (e.g. `sharp`)
// would also strip metadata, but adds a native dependency the project
// deliberately avoids (CLAUDE.md "keep dependency count minimal").

const KB = 1024;
export const MAX_PHOTO_BYTES = 2 * KB * KB; // 2 MB

interface ImageSignature {
  readonly bytes: readonly number[];
}

const IMAGE_SIGNATURES: readonly ImageSignature[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47] }, // PNG
  { bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF (GIF8)
];

function hasImageMagic(bytes: Uint8Array): boolean {
  return IMAGE_SIGNATURES.some((sig) => sig.bytes.every((byte, index) => bytes[index] === byte));
}

// What the caller should do with the owner's stored photo after this submit.
export type PhotoUpload =
  | { ok: true; action: "keep" } // leave the existing photo untouched
  | { ok: true; action: "remove" } // clear the stored photo (set to null)
  | { ok: true; action: "replace"; bytes: Buffer } // overwrite with these bytes
  | { ok: false; error: string };

const FIELD_FILE = "photo";
const FIELD_REMOVE = "removePhoto";

// Interprets the photo portion of a `/me` submit. Removal wins over any
// uploaded file. An absent or empty file input means "no change" so a staff
// member editing text fields doesn't have to re-pick their photo every time.
export async function readPhotoUpload(formData: FormData): Promise<PhotoUpload> {
  if (formData.get(FIELD_REMOVE) != null) {
    return { ok: true, action: "remove" };
  }

  const entry = formData.get(FIELD_FILE);
  if (!(entry instanceof File) || entry.size === 0) {
    return { ok: true, action: "keep" };
  }

  if (entry.size > MAX_PHOTO_BYTES) {
    const maxMb = MAX_PHOTO_BYTES / (KB * KB);
    return { ok: false, error: `Photo is too large — keep it under ${maxMb} MB.` };
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  if (!hasImageMagic(bytes)) {
    return { ok: false, error: "Photo must be a PNG, JPEG, or GIF image." };
  }

  return { ok: true, action: "replace", bytes: Buffer.from(bytes) };
}
