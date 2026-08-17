import { org } from "@/config/org";

interface BrandLogoProps {
  // Rendered pixel size of the square logo. The source master is 1024px
  // (public/brand/logo.png — see customization/README.md).
  size?: number;
  className?: string;
}

// The single brand mark (square logo on transparent, supplied by the deploying
// org in public/brand/). Plain <img> rather than next/image: it's a small
// static asset that never needs remote optimization, and this keeps the
// standalone build config trivial.
export function BrandLogo({ size = 40, className }: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static square brand asset, no optimization needed
    <img
      src="/brand/logo.png"
      alt={org.logoAlt}
      width={size}
      height={size}
      className={className}
      style={{ height: size, width: size }}
    />
  );
}
