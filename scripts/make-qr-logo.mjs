// Manual, dev-only generator for the QR centre logo asset
// (public/brand/qr-logo.png). NOT part of the build — run by hand only
// when the logo or plate design changes:  node scripts/make-qr-logo.mjs
//
// The plate is a radial white gradient: solid through the inner 75%, fading to
// fully transparent by 90%, so when it's embedded as the QR centre image
// (buildQrCodeOptions, hideBackgroundDots: false) it melts into the dots with
// no square/box. The org's brand logo (public/brand/logo.png) is composited on
// top. Baking it into a static asset keeps the exported QR self-contained.
//
// Uses `sharp`, which is present transitively (Next.js image optimisation);
// it is not a direct dependency because nothing at runtime needs it.
import sharp from "sharp";

const SIZE = 1024;
const LOGO_RATIO = 0.62;

const plateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="75%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="90%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
</svg>`;

const plate = await sharp(Buffer.from(plateSvg)).png().toBuffer();

const logoSize = Math.round(SIZE * LOGO_RATIO);
const logo = await sharp("public/brand/logo.png")
  .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await sharp(plate)
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile("public/brand/qr-logo.png");

console.log(`wrote public/brand/qr-logo.png (${SIZE}x${SIZE})`);
