"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMarketingSection, MarketingSection } from "../context/MarketingSectionContext";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { active, setActive } = useMarketingSection();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/auth";

  function goToSection(section: MarketingSection) {
    setActive(section);
    if (pathname !== "/") {
      router.push("/");
    }
  }

  if (isAuthPage) {
    return null;
  }

  return (
    <header
      className="site-header"
      style={{
        width: "100%",
        height: "4.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--spacing-collection-screen-margin)",
        backgroundColor: "var(--color-roles-surface)",
        color: "var(--color-roles-on-surface)",
        boxSizing: "border-box",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left side: Brand Logo */}
      <Link
        href="/"
        className="header-brand-link"
        onClick={(e) => {
          e.preventDefault();
          goToSection("home");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-collection-small-spacing)",
          textDecoration: "none",
          color: "var(--color-roles-on-surface)",
          borderRadius: "0.5rem",
        }}
      >
        <Image
          src="/favicon.svg"
          alt="Legible Favicon Logo"
          width={36}
          height={36}
          style={{ borderRadius: "0.5rem" }}
        />
        <span
          style={{
            fontFamily: "var(--typography-headline-small-font-family)",
            fontSize: "var(--typography-headline-small-font-size)",
            fontWeight: "var(--typography-headline-small-font-weight)",
            lineHeight: "var(--typography-headline-small-line-height)",
            letterSpacing: "var(--typography-headline-small-letter-spacing)",
          }}
        >
          Legible
        </span>
      </Link>

      {/* Hamburger button — visible only on mobile via CSS */}
      <button
        className="hamburger-button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileMenuOpen}
        style={{
          display: "none", /* shown via media query */
          position: "relative",
          zIndex: 60,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem",
          color: "var(--color-roles-on-surface)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {mobileMenuOpen ? (
            /* X icon */
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            /* Hamburger icon */
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Desktop nav — hidden on mobile via CSS */}
      <nav
        className="desktop-nav"
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-collection-large-spacing)",
        }}
      >
        <Link
          href="/"
          className="nav-link-hover"
          aria-current={active === "testimonials" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            goToSection("testimonials");
          }}
          style={{ color: active === "testimonials" ? "var(--color-roles-primary)" : undefined }}
        >
          Testimonials
        </Link>
        <Link
          href="/"
          className="nav-link-hover"
          aria-current={active === "contact" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            goToSection("contact");
          }}
          style={{ color: active === "contact" ? "var(--color-roles-primary)" : undefined }}
        >
          Contact
        </Link>
      </nav>

      {/* Desktop CTA — hidden on mobile via CSS */}
      <Link
        href="/auth?mode=signup"
        className="header-cta-button desktop-cta"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-roles-primary)",
          color: "var(--color-roles-on-primary)",
          padding: "0.5rem 1.75rem",
          borderRadius: "0.375rem",
          fontFamily: "var(--typography-label-large-font-family)",
          fontSize: "0.9375rem",
          fontWeight: "var(--typography-label-large-font-weight)",
          lineHeight: "var(--typography-label-large-line-height)",
          textDecoration: "none",
          boxShadow: "var(--effect-soft-shadow)",
        }}
      >
        Get Started
      </Link>

      {/* Full-screen mobile drawer — toggled by hamburger */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--color-roles-surface)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2rem",
            paddingLeft: "var(--spacing-collection-large-spacing)",
            paddingRight: "var(--spacing-collection-large-spacing)",
            boxSizing: "border-box",
            zIndex: 50,
            animation: "mobileMenuFade 0.25s ease-out",
          }}
        >
          <Link
            href="/"
            className="nav-link-hover"
            aria-current={active === "testimonials" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goToSection("testimonials");
              setMobileMenuOpen(false);
            }}
            style={{
              fontSize: "1.25rem",
              color: active === "testimonials" ? "var(--color-roles-primary)" : undefined,
            }}
          >
            Testimonials
          </Link>
          <Link
            href="/"
            className="nav-link-hover"
            aria-current={active === "contact" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goToSection("contact");
              setMobileMenuOpen(false);
            }}
            style={{
              fontSize: "1.25rem",
              color: active === "contact" ? "var(--color-roles-primary)" : undefined,
            }}
          >
            Contact
          </Link>
          <Link
            href="/auth?mode=signup"
            className="header-cta-button"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              boxSizing: "border-box",
              backgroundColor: "var(--color-roles-primary)",
              color: "var(--color-roles-on-primary)",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              fontFamily: "var(--typography-label-large-font-family)",
              fontSize: "0.9375rem",
              fontWeight: "var(--typography-label-large-font-weight)",
              lineHeight: "var(--typography-label-large-line-height)",
              textDecoration: "none",
              boxShadow: "var(--effect-soft-shadow)",
              marginTop: "0.5rem",
            }}
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
