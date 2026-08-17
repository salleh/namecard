import type { OrgConfigInput } from "@/config/orgSchema";

// =============================================================================
// Organization customization — EDIT THIS FILE when deploying for your org.
//
// This is the single place the app reads organization identity from: names,
// copy, email domain hint, vCard company defaults, and PWA colors. It is
// validated at startup by src/config/org.ts (see src/config/orgSchema.ts for
// what each field does), and it ships in the client bundle — so branding only,
// NEVER secrets. Secrets and the public FQDN live in .env (see .env.example).
//
// The rest of the customization surface:
//   - customization/theme.css   — brand color palette + font stack
//   - public/brand/logo.png     — square brand logo (1024×1024, transparent)
//   - public/brand/qr-logo.png  — QR center overlay (scripts/make-qr-logo.mjs)
//   - public/icons/icon-*.png   — PWA icons (scripts/make-brand-assets.mjs)
// Full guide: customization/README.md
// =============================================================================

export const orgConfig = {
  appName: "e-Namecard",
  appShortName: "e-Namecard",
  appDescription: "Staff electronic namecard with vCard QR.",

  orgName: "Example Organization",
  orgLegalName: "Example Organization Inc.",

  emailDomain: "example.com",

  // vCard defaults applied when a staff card leaves these fields blank.
  website: "https://www.example.com",
  address: "1 Example Street, 10000 Example City",

  // Keep these in sync with the brand palette in customization/theme.css.
  themeColor: "#f26522",
  backgroundColor: "#ffffff",

  logoAlt: "Example Organization",
} satisfies OrgConfigInput;
