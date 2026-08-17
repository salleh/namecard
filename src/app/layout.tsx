import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { org } from "@/config/org";
import "./globals.css";

export const metadata: Metadata = {
  title: org.appName,
  description: org.appDescription,
  applicationName: org.appName,
};

export const viewport: Viewport = { themeColor: org.themeColor };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
