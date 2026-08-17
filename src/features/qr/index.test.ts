import { describe, expect, it } from "vitest";
import { buildQrCodeOptions } from "./index";

describe("qr public API", () => {
  it("exposes buildQrCodeOptions, building a level-H options object", () => {
    const options = buildQrCodeOptions({ displayName: "Jane Tan" });

    expect(options.qrOptions?.errorCorrectionLevel).toBe("H");
    // Logo is embedded as the pre-baked, edge-transparent asset (self-contained).
    expect(options.image).toBe("/brand/qr-logo.png");
  });
});
