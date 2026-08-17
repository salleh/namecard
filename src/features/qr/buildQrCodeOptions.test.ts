import { describe, expect, it } from "vitest";
import { buildVCard } from "../vcard";
import type { VCardInput } from "../vcard";
import { buildQrCodeOptions } from "./buildQrCodeOptions";

const STAFF_INPUT: VCardInput = {
  displayName: "Jane Tan",
  givenName: "Jane",
  surname: "Tan",
  email: "jane.tan@example.com",
};

const PHOTO_URL = "https://namecard.example.com/avatar/jane.tan";

describe("buildQrCodeOptions", () => {
  it("sets error-correction level H", () => {
    const options = buildQrCodeOptions(STAFF_INPUT);

    expect(options.qrOptions?.errorCorrectionLevel).toBe("H");
  });

  it("embeds the pre-baked brand logo asset without clearing a square", () => {
    const options = buildQrCodeOptions(STAFF_INPUT);

    // The edge-transparent asset does the blending, so we must NOT let the
    // library clear a square block of dots behind it (that is the white box).
    expect(options.image).toBe("/brand/qr-logo.png");
    expect(options.imageOptions?.hideBackgroundDots).toBe(false);
  });

  it("encodes the same vCard text produced by buildVCard with a uri photo", () => {
    expect(buildQrCodeOptions(STAFF_INPUT).data).toBe(buildVCard(STAFF_INPUT, {}));
    expect(buildQrCodeOptions(STAFF_INPUT, PHOTO_URL).data).toBe(
      buildVCard(STAFF_INPUT, { photo: { kind: "uri", url: PHOTO_URL } }),
    );
  });

  it("carries a PHOTO;VALUE=URI line only when a photo URL is supplied", () => {
    expect(buildQrCodeOptions(STAFF_INPUT).data).not.toContain("PHOTO");
    expect(buildQrCodeOptions(STAFF_INPUT, PHOTO_URL).data).toContain(
      `PHOTO;VALUE=URI:${PHOTO_URL}`,
    );
  });

  it("returns a fresh options object per call (no shared mutable state)", () => {
    const first = buildQrCodeOptions(STAFF_INPUT);
    const second = buildQrCodeOptions(STAFF_INPUT);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
