// Sniffs an image's content type from its leading magic bytes so the avatar
// endpoint can send a correct `Content-Type` without trusting or storing a
// separate mime column. Covers the formats Microsoft Graph's `/me/photo/$value`
// and typical staff uploads produce (PNG/JPEG/GIF); unrecognized bytes default
// to `image/jpeg` (Graph's own default photo format, and the safe fallback).
interface ImageSignature {
  contentType: string;
  bytes: readonly number[];
}

const SIGNATURES: readonly ImageSignature[] = [
  { contentType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { contentType: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];

export function detectImageContentType(bytes: Uint8Array): string {
  const match = SIGNATURES.find((signature) =>
    signature.bytes.every((byte, index) => bytes[index] === byte),
  );
  return match?.contentType ?? "image/jpeg";
}
