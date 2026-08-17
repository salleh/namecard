// Manual, dev-only generator for NEUTRAL PLACEHOLDER brand assets:
//   public/brand/logo.png        — square placeholder logo (1024×1024)
//   public/icons/icon-192.png    — PWA icon
//   public/icons/icon-512.png    — PWA icon
//
// Run:  node scripts/make-brand-assets.mjs   (then: node scripts/make-qr-logo.mjs)
//
// A deploying org should REPLACE these with real brand assets (see
// customization/README.md) — this script only exists so a fresh fork boots
// with something visually coherent instead of broken images.
//
// Uses `sharp`, present transitively via Next.js image optimisation.
import sharp from "sharp";

// Keep in sync with --color-brand-500 in customization/theme.css.
const BRAND_COLOR = "#f26522";

// A simple "contact card" glyph: rounded card outline, avatar circle, and
// detail lines — recognizable at 192px, trademark-free.
function cardGlyphSvg(size, { background, foreground, padded }) {
  const pad = padded ? size * 0.18 : size * 0.08;
  const w = size - pad * 2;
  const cardH = w * 0.68;
  const cardY = (size - cardH) / 2;
  const r = w * 0.09;
  const stroke = Math.max(2, w * 0.055);
  const cx = pad + w * 0.3;
  const cy = cardY + cardH * 0.42;
  const headR = w * 0.09;
  const lineX = pad + w * 0.52;
  const lineW = w * 0.28;
  const lineH = Math.max(2, w * 0.05);
  const bg = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${bg}
  <rect x="${pad}" y="${cardY}" width="${w}" height="${cardH}" rx="${r}"
        fill="none" stroke="${foreground}" stroke-width="${stroke}"/>
  <circle cx="${cx}" cy="${cy}" r="${headR}" fill="${foreground}"/>
  <path d="M ${cx - headR * 1.7} ${cardY + cardH * 0.78}
           Q ${cx} ${cardY + cardH * 0.52} ${cx + headR * 1.7} ${cardY + cardH * 0.78}"
        fill="${foreground}"/>
  <rect x="${lineX}" y="${cy - headR}" width="${lineW}" height="${lineH}" rx="${lineH / 2}" fill="${foreground}"/>
  <rect x="${lineX}" y="${cy + headR * 0.4}" width="${lineW * 0.75}" height="${lineH}" rx="${lineH / 2}" fill="${foreground}"/>
</svg>`;
}

// Logo: brand-colored glyph on transparent, like a real logo master would be.
await sharp(Buffer.from(cardGlyphSvg(1024, { foreground: BRAND_COLOR, padded: false })))
  .png()
  .toFile("public/brand/logo.png");
console.log("wrote public/brand/logo.png (1024x1024)");

// PWA icons: white glyph on solid brand background (full-bleed works for both
// `any` and `maskable` purposes declared in src/app/manifest.ts).
for (const size of [192, 512]) {
  await sharp(
    Buffer.from(
      cardGlyphSvg(size, { background: BRAND_COLOR, foreground: "#ffffff", padded: true }),
    ),
  )
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`wrote public/icons/icon-${size}.png (${size}x${size})`);
}
