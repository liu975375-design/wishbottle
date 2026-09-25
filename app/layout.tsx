import type { Metadata, Viewport } from "next";

import { SiteHeader } from "./components/SiteHeader";

import "./globals.css";
import "./phase1.css";

export const metadata: Metadata = {
  title: "WishBottle",
  description: "Make a wish and find it again with your Wish Code and PIN.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <SiteHeader />
          <main className="page">{children}</main>
          <footer className="site-footer">
            <p>
              Small wishes. <span>Brighter tomorrows.</span>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
