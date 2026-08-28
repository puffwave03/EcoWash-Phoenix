"use client";

import type { ReactNode } from "react";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { Link, usePathname } from "@/i18n/navigation";

export function PlatformShell({ children, locale, operatorName, tenantName, text }: {
  children: ReactNode;
  locale: string;
  operatorName: string;
  tenantName?: string;
  text: {
    logout: string;
    navigationLabel: string;
    organizations: string;
    overview: string;
    product: string;
    role: string;
    switchToTenant: string;
  };
}) {
  const pathname = usePathname();
  const items = [
    { href: "/platform", label: text.overview },
    { href: "/platform/organizations", label: text.organizations },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f5] text-foreground lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-border bg-white px-5 py-5 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
        <div className="flex items-center justify-between gap-4 lg:block">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{text.product}</p>
            <p className="mt-1 text-xl font-semibold text-primary">Phoenix Platform</p>
          </div>
          <div className="text-right lg:mt-8 lg:text-left">
            <p className="text-sm font-semibold text-primary">{operatorName}</p>
            <p className="text-xs text-muted">{text.role}</p>
          </div>
        </div>
        <nav aria-label={text.navigationLabel} className="mt-5 flex gap-2 overflow-x-auto lg:mt-8 lg:block lg:space-y-2">
          {items.map((item) => {
            const active = item.href === "/platform"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                className={`block min-h-11 whitespace-nowrap rounded-control px-4 py-3 text-sm font-semibold transition-standard ${active ? "bg-primary !text-white" : "text-primary hover:bg-primary-soft"}`}
                href={item.href}
                key={item.href}
                locale={locale}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-5 lg:absolute lg:bottom-7 lg:left-6 lg:right-6">
          {tenantName ? (
            <Link
              className="mb-3 flex min-h-11 items-center justify-between rounded-control border border-border px-3 text-sm font-semibold !text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href="/app"
              locale={locale}
            >
              {text.switchToTenant}<span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <LogoutButton label={text.logout} locale={locale} />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
