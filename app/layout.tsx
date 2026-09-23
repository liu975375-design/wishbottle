import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "WishBottle",
  description: "Make a wish and find it again with your Wish Code and PIN.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff8f0",
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
          <header className="site-header">
            <Link className="brand" href="/">
              <span aria-hidden="true" className="brand-heart">
                ♡
              </span>
              WishBottle
            </Link>
            <nav aria-label="Primary navigation" className="site-nav">
              <Link href="/create">Make a Wish</Link>
              <Link href="/find">Find My Wish</Link>
            </nav>
          </header>
          <main className="page">{children}</main>
          <footer className="site-footer">
            <p>
              Small wishes.
              <span> Brighter tomorrows.</span>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
