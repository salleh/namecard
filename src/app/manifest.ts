import type { MetadataRoute } from "next";
import { org } from "@/config/org";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable app identity so re-installs/updates map to the same installed app.
    id: "/",
    name: org.appName,
    short_name: org.appShortName,
    description: org.appDescription,
    start_url: "/",
    scope: "/",
    lang: "en",
    display: "standalone",
    orientation: "portrait",
    background_color: org.backgroundColor,
    theme_color: org.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Same 512 also advertised as maskable (Android adaptive icons / splash).
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
