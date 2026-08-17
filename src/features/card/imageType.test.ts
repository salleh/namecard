import { describe, expect, it } from "vitest";
import { detectImageContentType } from "./imageType";

describe("detectImageContentType", () => {
  it("detects PNG from its magic bytes", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(detectImageContentType(png)).toBe("image/png");
  });

  it("detects JPEG from its magic bytes", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    expect(detectImageContentType(jpeg)).toBe("image/jpeg");
  });

  it("detects GIF from its magic bytes", () => {
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

    expect(detectImageContentType(gif)).toBe("image/gif");
  });

  it("defaults to image/jpeg for unrecognized bytes", () => {
    const unknown = Uint8Array.from([0x00, 0x01, 0x02, 0x03]);

    expect(detectImageContentType(unknown)).toBe("image/jpeg");
  });
});
