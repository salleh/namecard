# Brand assets

Replace these with your organization's assets (keep the filenames):

- `logo.png` — square brand logo master, 1024×1024, transparent background.
  Shown in the site header/landing page and cached for offline QR rendering.
- `qr-logo.png` — the QR center overlay, generated from `logo.png` by
  `node scripts/make-qr-logo.mjs`. Regenerate after replacing the logo.

The checked-in files are neutral placeholders produced by
`scripts/make-brand-assets.mjs`. The app boots without these binaries present;
they are only required for the QR overlay and header/landing rendering.

See `customization/README.md` for the full customization guide.
