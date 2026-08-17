// Feature: qr — styled QR via qr-code-styling: centered brand logo,
// error-correction level H, encodes vCard text WITHOUT the photo. Step 3.
//
// Core vs. render split: `qr-code-styling` is a DOM/canvas-oriented
// rendering library (`new QRCodeStyling(options).append(container)`).
// Actually instantiating and rendering it is a browser-only concern that
// belongs to a thin client component in Step 4's public card page. This
// module only builds the *options* object — a plain, pure, JSON-serializable
// value — so it stays unit-testable in plain Node/jsdom without pulling in
// a native `canvas`/server-side-rendering dependency.
export { buildQrCodeOptions } from "./buildQrCodeOptions";
