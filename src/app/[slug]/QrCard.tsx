"use client";

import type { Options } from "qr-code-styling";
import { useEffect, useRef } from "react";

interface QrCardProps {
  options: Options;
}

// qr-code-styling is DOM-oriented, so it is imported dynamically inside the
// effect (never during SSR) and rendered into a container ref on the client.
//
// The centred brand logo is embedded by the library itself (see
// buildQrCodeOptions → the pre-baked, edge-transparent asset), so the rendered
// QR is self-contained and stays intact if exported/downloaded as an image.
export function QrCard({ options }: QrCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !container) {
        return;
      }
      container.replaceChildren();
      new QRCodeStyling(options).append(container);
    });

    return () => {
      cancelled = true;
    };
  }, [options]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="QR code — scan to add this contact"
      className="mx-auto w-fit [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-[320px]"
    />
  );
}
