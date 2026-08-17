import { z } from "zod";

// Schema for the organization customization file (customization/org.ts).
// Branding/identity only — never put secrets here: this config is imported by
// client components and ships in the browser bundle. Secrets (Entra, DB,
// AUTH_*) stay in environment variables (src/config/env.ts).

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
// Bare domain like "example.com" or "sub.example.co.uk" — no scheme, no "@".
const EMAIL_DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export const orgConfigSchema = z.object({
  // Full application title — browser tab, PWA name, page headings.
  appName: z.string().min(1, "appName is required"),
  // Short label for tight spots: PWA short_name, the site header.
  appShortName: z.string().min(1, "appShortName is required"),
  // One-line description — <meta name="description"> and the PWA manifest.
  appDescription: z.string().min(1, "appDescription is required"),
  // Everyday organization name used in UI copy ("Acme staff? Sign in…").
  orgName: z.string().min(1, "orgName is required"),
  // Legal/formal name — default ORG value on generated vCards.
  orgLegalName: z.string().min(1, "orgLegalName is required"),
  // Staff email domain, e.g. "example.com". Display-only: shown as the
  // suffix hint next to the lookup field. Authentication is governed by the
  // Entra tenant (env), not by this value.
  emailDomain: z
    .string()
    .regex(EMAIL_DOMAIN_PATTERN, 'emailDomain must be a bare domain like "example.com"'),
  // Company website — default URL field on generated vCards.
  website: z.string().url("website must be a valid URL"),
  // Company postal address — default ADR field on generated vCards. May be
  // empty, in which case cards without a personal address carry none.
  address: z.string(),
  // PWA/manifest theme color. Keep in sync with the brand palette in
  // customization/theme.css (CSS cannot be read from here).
  themeColor: z.string().regex(HEX_COLOR_PATTERN, "themeColor must be a #rrggbb hex color"),
  // PWA manifest/splash background color.
  backgroundColor: z
    .string()
    .regex(HEX_COLOR_PATTERN, "backgroundColor must be a #rrggbb hex color"),
  // Alt text for the brand logo image.
  logoAlt: z.string().min(1, "logoAlt is required"),
});

export type OrgConfig = z.infer<typeof orgConfigSchema>;
export type OrgConfigInput = z.input<typeof orgConfigSchema>;
