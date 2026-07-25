"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";

const navigationItems = [
  "Home",
  "Solutions",
  "Services",
  "Industries",
  "Pricing",
  "Resources",
  "Contact",
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <Container>
        <div className="flex min-h-20 items-center justify-between gap-6">
          <Link
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/"
            aria-label="EcoWash Phoenix home"
          >
            <span className="flex size-11 items-center justify-center rounded-logo border border-secondary/40 bg-primary text-sm font-semibold text-white shadow-card">
              EP
            </span>
            <span className="text-sm font-semibold tracking-wide text-text">
              EcoWash Phoenix
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {navigationItems.map((item) => (
              <button
                className="text-sm font-medium text-muted transition-standard hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                key={item}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button>Request a Demo</Button>
          </div>

          <button
            aria-controls="mobile-navigation"
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex size-11 items-center justify-center rounded-control border border-border bg-surface text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden"
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

        {isOpen ? (
          <nav
            id="mobile-navigation"
            className="border-t border-border py-5 lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-1">
              {navigationItems.map((item) => (
                <button
                  className="rounded-control px-3 py-3 text-left text-sm font-medium text-muted transition-standard hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  key={item}
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {item}
                </button>
              ))}
              <Button className="mt-4 w-full">Request a Demo</Button>
            </div>
          </nav>
        ) : null}
      </Container>
    </header>
  );
}
