import { describe, expect, it } from "vitest";
import { encodeEmbeddedPhoto } from "./embedPhoto";

describe("encodeEmbeddedPhoto", () => {
  it("emits PHOTO;ENCODING=b with the sniffed image TYPE token and base64 body", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(encodeEmbeddedPhoto(png)).toBe(
      `PHOTO;ENCODING=b;TYPE=PNG:${Buffer.from(png).toString("base64")}`,
    );
  });

  it("maps JPEG and GIF magic bytes to their TYPE tokens", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38]);

    expect(encodeEmbeddedPhoto(jpeg)).toContain("TYPE=JPEG:");
    expect(encodeEmbeddedPhoto(gif)).toContain("TYPE=GIF:");
  });

  it("defaults unrecognized bytes to TYPE=JPEG", () => {
    const unknown = Uint8Array.from([0x00, 0x01, 0x02, 0x03]);

    expect(encodeEmbeddedPhoto(unknown)).toContain("TYPE=JPEG:");
  });

  it("base64-encodes the exact byte content", () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5]);

    expect(encodeEmbeddedPhoto(bytes)).toContain(Buffer.from(bytes).toString("base64"));
  });
});
