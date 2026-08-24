"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import {
  DEFAULT_PORTAL_BRAND,
  type PortalBrandPresentation,
} from "@/features/portal/media";
import { Link, usePathname } from "@/i18n/navigation";

type CustomerPortalShellText = {
  assistance: string;
  logout: string;
  navigationLabel: string;
  newRequest?: string;
  orders: string;
  overview: string;
  profile: string;
  title: string;
};

type CustomerPortalShellProps = {
  brand?: PortalBrandPresentation;
  children: ReactNode;
  customerName?: string;
  locale: string;
  text: CustomerPortalShellText;
};

type PortalNavigationItem = {
  href: string;
  icon: "assistance" | "new" | "orders" | "overview";
  label: string;
  match: string;
};

function PortalIcon({ icon }: { icon: PortalNavigationItem["icon"] }) {
  const classes = "h-5 w-5";

  if (icon === "orders") {
    return <svg aria-hidden="true" className={classes} fill="none" viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v14H7a3 3 0 0 1-3-3V4h3Zm0 10h12M9 8h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }

  if (icon === "new") {
    return <svg aria-hidden="true" className={classes} fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
  }

  if (icon === "assistance") {
    return <svg aria-hidden="true" className={classes} fill="none" viewBox="0 0 24 24"><path d="M5 16a4 4 0 0 1-2-3.5v-1a9 9 0 0 1 18 0v1a4 4 0 0 1-4 4h-2v-6h5M9 16H7a4 4 0 0 1-4-4m6-1.5v6H5m4 0c0 2 1 3 3 3h2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }

  return <svg aria-hidden="true" className={classes} fill="none" viewBox="0 0 24 24"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

export function CustomerPortalShell({
  brand = DEFAULT_PORTAL_BRAND,
  children,
  customerName,
  locale,
  text,
}: CustomerPortalShellProps) {
  const pathname = usePathname();
  const brandStyle = {
    ...(brand.primaryColor ? { "--color-primary": brand.primaryColor } : {}),
    ...(brand.primarySoftColor ? { "--color-primary-soft": brand.primarySoftColor } : {}),
    ...(brand.primaryStrongColor ? { "--color-primary-strong": brand.primaryStrongColor } : {}),
  } as CSSProperties;
  const navigationItems: PortalNavigationItem[] = [
    { href: "/portal", icon: "overview", label: text.overview, match: "/portal" },
    { href: "/portal/orders", icon: "orders", label: text.orders, match: "/portal/orders" },
    ...(text.newRequest
      ? [{ href: "/portal/requests/new", icon: "new" as const, label: text.newRequest, match: "/portal/requests" }]
      : []),
    { href: "/contact", icon: "assistance", label: text.assistance, match: "/contact" },
  ];
  const isActive = (item: PortalNavigationItem) => (
    item.match === "/portal" ? pathname === item.match : pathname.startsWith(item.match)
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,var(--color-primary-soft),transparent_28rem),#f4f7f4] text-foreground" data-customer-portal-shell style={brandStyle}>
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/92 shadow-[0_4px_18px_rgb(15_59_46_/_0.035)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:min-h-20 sm:px-6 lg:px-8">
          <Link
            aria-label={text.overview}
            className="flex min-w-0 items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/portal"
            locale={locale}
          >
            <span className={`flex h-10 shrink-0 items-center justify-center rounded-logo bg-primary-soft text-primary ring-1 ring-inset ring-primary/10 ${brand.logoPath ? "w-20 px-2" : "w-10"}`}>
              {brand.logoPath ? (
                <Image
                  alt={brand.logoAlt ?? ""}
                  className="h-8 w-full object-contain"
                  height={40}
                  sizes="80px"
                  src={brand.logoPath}
                  unoptimized={/^https?:\/\//.test(brand.logoPath)}
                  width={96}
                />
              ) : (
                <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M19 4C11 5 6 9 5 17c4-3 8-4 13-4M5 17c2 0 4 1 5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
              )}
            </span>
            <span className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{brand.name ?? text.title}</span>
          </Link>

          <nav aria-label={text.navigationLabel} className="hidden items-center gap-1 lg:flex">
            {navigationItems.map((item) => (
              <Link
                aria-current={isActive(item) ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isActive(item) ? "bg-primary !text-white shadow-sm" : "!text-muted hover:bg-primary-soft hover:!text-primary"
                }`}
                href={item.href}
                key={item.href}
                locale={locale}
              >
                <PortalIcon icon={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <details className="group relative">
              <summary
                aria-label={text.profile}
                className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control border border-border bg-white px-3 text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
                <span className="hidden max-w-32 truncate text-sm font-semibold lg:block">{customerName ?? text.profile}</span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-white p-4 shadow-luxury">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{text.profile}</p>
                {customerName ? <p className="mt-1 break-words font-semibold text-foreground">{customerName}</p> : null}
                <div className="mt-4 border-t border-border pt-4 sm:hidden"><LanguageSwitcher /></div>
                <div className="mt-4 border-t border-border pt-4">
                  <LogoutButton className="w-full" label={text.logout} locale={locale} />
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 pb-[calc(6.5rem_+_env(safe-area-inset-bottom))] sm:px-6 sm:py-9 lg:px-8 lg:pb-12">
        {children}
      </section>

      <nav
        aria-label={text.navigationLabel}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/96 px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_-6px_20px_rgb(15_59_46_/_0.06)] backdrop-blur lg:hidden"
      >
        <div className={`mx-auto grid max-w-lg gap-1 ${navigationItems.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {navigationItems.map((item) => (
            <Link
              aria-current={isActive(item) ? "page" : undefined}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-control px-1 text-center text-[0.6875rem] font-semibold leading-none transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive(item) ? "bg-primary-soft !text-primary" : "!text-muted"
              }`}
              href={item.href}
              key={item.href}
              locale={locale}
            >
              <PortalIcon icon={item.icon} />
              <span className="block max-w-full truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
