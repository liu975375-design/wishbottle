"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "./BrandLogo";

type IconName = "home" | "write" | "search" | "star" | "info";

function MenuIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 10 7-6 7 6" />
        <path d="M5.5 9.5V17h9V9.5" />
      </>
    ),
    write: (
      <>
        <path d="m5 15.5-.5 3 3-.5L16 9.5 12.5 6 5 13.5Z" />
        <path d="m11.5 7 3.5 3.5" />
      </>
    ),
    search: (
      <>
        <circle cx="9.5" cy="9.5" r="4.5" />
        <path d="m13 13 3.5 3.5" />
      </>
    ),
    star: <path d="m10 3 1.8 4 4.4.6-3.2 3 .8 4.4-3.8-2.1-3.8 2.1.8-4.4-3.2-3 4.4-.6Z" />,
    info: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 9v5M10 6.5v.1" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" className="menu-item-icon" viewBox="0 0 20 20">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">
        {paths[name]}
      </g>
    </svg>
  );
}

const MENU_LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/create", label: "Make a New Wish", icon: "write" },
  { href: "/find", label: "Find My Wish", icon: "search" },
  { href: "/explore", label: "Explore Special Journeys", icon: "star" },
  { href: "/about", label: "About WishBottle", icon: "info" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function goBack() {
    if (pathname === "/create") {
      const backRequest = new CustomEvent("wishbottle:request-back", {
        cancelable: true,
      });

      if (!window.dispatchEvent(backRequest)) {
        return;
      }
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <header className={`site-header ${menuOpen ? "menu-is-open" : ""}`}>
      <div className={`site-header-bar ${isHome ? "is-home" : "is-inner"}`}>
        {!isHome ? (
          <button aria-label="Go back" className="header-control" onClick={goBack} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m14.5 5-7 7 7 7" />
            </svg>
          </button>
        ) : null}

        <Link aria-label="WishBottle home" className="brand-logo" href="/" onClick={() => setMenuOpen(false)}>
          <BrandLogo priority />
        </Link>

        <button
          aria-controls="wishbottle-menu"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="header-control menu-toggle"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          {menuOpen ? (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          )}
        </button>
      </div>

      <button
        aria-label="Close navigation"
        className={`nav-scrim ${menuOpen ? "is-visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
        type="button"
      />

      <aside
        aria-hidden={!menuOpen}
        aria-label="WishBottle navigation"
        className={`nav-drawer ${menuOpen ? "is-open" : ""}`}
        id="wishbottle-menu"
      >
        <div className="nav-drawer-top">
          <BrandLogo />
          <button aria-label="Close menu" className="drawer-close" onClick={() => setMenuOpen(false)} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="drawer-nav">
          {MENU_LINKS.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
              <MenuIcon name={item.icon} />
              <span>{item.label}</span>
              <svg aria-hidden="true" className="menu-item-chevron" viewBox="0 0 20 20">
                <path d="m8 5 5 5-5 5" />
              </svg>
            </Link>
          ))}
        </nav>

      </aside>
    </header>
  );
}
