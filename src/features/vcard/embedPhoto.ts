import { detectImageContentType } from "@/features/card/imageType";

// vCard 3.0 `TYPE` token for the sniffed image content type. RFC 2426 §3.1.4
// uses the bare image subtype (JPEG/PNG/GIF), not the MIME string.
const TYPE_TOKEN_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/gif": "GIF",
};

// Encodes raw image bytes as a base64-inlined `PHOTO;ENCODING=b` property for the
// `.vcf` download — self-contained, so importing the file into an address book
// needs no network round trip. The QR uses the URI form instead (see buildVCard).
export function encodeEmbeddedPhoto(bytes: Uint8Array): string {
  const contentType = detectImageContentType(bytes);
  const typeToken = TYPE_TOKEN_BY_CONTENT_TYPE[contentType] ?? "JPEG";
  const base64 = Buffer.from(bytes).toString("base64");
  return `PHOTO;ENCODING=b;TYPE=${typeToken}:${base64}`;
}
