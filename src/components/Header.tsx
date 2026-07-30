"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Container } from "@/components/Container";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Link, usePathname } from "@/i18n/navigation";

const navigationItems = [
  { href: "/", key: "home" },
  { href: "/#solutions", key: "solutions" },
  { href: "/#services", key: "services" },
  { href: "/#industries", key: "industries" },
  { href: "/contact", key: "contact" },
] as const;

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const brand = useTranslations("common.brand");
  const navigation = useTranslations("common.navigation");
  const isActive = (key: (typeof navigationItems)[number]["key"]) =>
    (key === "home" && pathname === "/") ||
    (key === "contact" && pathname === "/contact");

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <Container>
        <div className="flex min-h-20 items-center justify-between gap-6">
          <Link
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/"
            aria-label={brand("logoLabel")}
          >
            <span className="flex items-center justify-center rounded-logo border border-border bg-surface px-2 py-1 shadow-card">
              <BrandLogo alt="" priority />
            </span>
            <span className="text-sm font-semibold tracking-wide text-text">
              {brand("name")}
            </span>
          </Link>

          <nav
            className="hidden items-center gap-7 lg:flex"
            aria-label={navigation("primaryLabel")}
          >
            {navigationItems.map((item) => (
              <Link
                aria-current={isActive(item.key) ? "page" : undefined}
                className={`text-sm font-medium transition-standard hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isActive(item.key) ? "text-primary" : "text-muted"
                }`}
                href={item.href}
                key={item.key}
              >
                {navigation(item.key)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher />
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-primary transition-standard hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href="/login"
            >
              {navigation("login")}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-luxury transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href="/contact"
            >
              {navigation("requestDemo")}
            </Link>
          </div>

          <div className="flex items-center lg:hidden">
            <button
              aria-controls="mobile-navigation"
              aria-expanded={isOpen}
              aria-label={navigation("toggleMenu")}
              className="inline-flex size-11 touch-manipulation items-center justify-center rounded-control border border-border bg-surface text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => setIsOpen((current) => !current)}
              type="button"
            >
              <span className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="h-0.5 w-5 bg-current" />
                <span className="h-0.5 w-5 bg-current" />
                <span className="h-0.5 w-5 bg-current" />
              </span>
            </button>
          </div>
        </div>

        {isOpen ? (
          <nav
            id="mobile-navigation"
            className="absolute inset-x-0 top-full z-50 border-t border-border bg-background px-4 py-5 shadow-card lg:hidden"
            aria-label={navigation("mobileLabel")}
          >
            <div className="flex flex-col gap-1">
              {navigationItems.map((item) => (
                <Link
                  aria-current={isActive(item.key) ? "page" : undefined}
                  className={`rounded-control px-3 py-3 text-left text-sm font-medium transition-standard hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isActive(item.key) ? "text-primary" : "text-muted"
                  }`}
                  href={item.href}
                  key={item.key}
                  onClick={() => setIsOpen(false)}
                >
                  {navigation(item.key)}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-3">
                <LanguageSwitcher />
                <Link
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-standard hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  href="/login"
                  onClick={() => setIsOpen(false)}
                >
                  {navigation("login")}
                </Link>
                <Link
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-luxury transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  href="/contact"
                  onClick={() => setIsOpen(false)}
                >
                  {navigation("requestDemo")}
                </Link>
              </div>
            </div>
          </nav>
        ) : null}
      </Container>
    </header>
  );
}
