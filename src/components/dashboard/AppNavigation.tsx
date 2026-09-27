"use client";

import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { hasOperationalCapability } from "@/lib/auth/capabilities";
import type { OperationalCapability } from "@/lib/auth/capabilities";
import type { AppRole } from "@/lib/auth/types";
import {
  entitlementEnabled,
  FEATURES,
  type EntitlementAccess,
} from "@/features/entitlements/feature-catalog";

type AppNavigationText = {
  accounting: string;
  alerts: string;
  billing: string;
  controlCenter: string;
  controlGroup: string;
  customers: string;
  dailyClose: string;
  delivery: string;
  managementGroup: string;
  more: string;
  closeMore: string;
  orders: string;
  warehouse: string;
  pos: string;
  overview: string;
  production: string;
  quality: string;
  services: string;
  shop: string;
  settings: string;
  toolsGroup: string;
  work: string;
  workExperience: string;
  workGroup: string;
};

type AppNavigationProps = {
  alertCount?: number;
  capabilities?: OperationalCapability[];
  locale: string;
  mode: "desktop" | "header" | "mobile";
  navigationLabel: string;
  organizationLabel?: string;
  organizationName?: string;
  platformAccess?: boolean;
  currentUserName?: string;
  entitlements?: EntitlementAccess;
  logoutErrorLabel?: string;
  logoutLabel?: string;
  role?: AppRole;
  roleLabel?: string;
  switchToPlatformLabel?: string;
  text: AppNavigationText;
  userLabel?: string;
};

type NavigationItem = {
  alertBadge?: boolean;
  aliases?: string[];
  href: string;
  label: string;
  match: string;
};

type NavigationGroup = {
  items: NavigationItem[];
  label: string;
};

function NavigationIcon({ href }: { href: string }) {
  const iconClasses = "h-5 w-5";

  if (href === "/app" || href === "/app/control") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/app/orders") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M8 5h10a2 2 0 0 1 2 2v12H8a3 3 0 0 1-3-3V5m0 11a3 3 0 0 1 3-3h12M5 5h3v8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/app/pos" || href === "/app/shop") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M5 4h14v16H5V4Zm3 3h8v4H8V7Zm0 8h2m2 0h2m2 0h1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/app/work") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="m5 7 1.5 1.5L9 6M12 7h7M5 12l1.5 1.5L9 11m3 1h7M5 17l1.5 1.5L9 16m3 1h7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/app/alerts") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/app/production" || href === "/app/work/production") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M4 19h16M6 19v-8l4 3v-4l4 3V7h4v12M15 7V4h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/app/settings") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.09A1.7 1.7 0 0 0 8.45 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.05 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.3V9.55h.09A1.7 1.7 0 0 0 4.05 8.45a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.86-2.86.06.06A1.7 1.7 0 0 0 8.45 4.05a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.3h4.05v.09A1.7 1.7 0 0 0 15 4.05a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.45c.16.43.42.79.76 1.07.31.25.69.39 1.09.39H21v4.05h-.09A1.7 1.7 0 0 0 19.4 15Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      </svg>
    );
  }

  if (href === "/app/delivery" || href === "/app/work/deliveries") {
    return (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path d="M3 6h11v11H3V6Zm11 4h4l3 3v4h-7v-7ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function AppNavigation({
  alertCount = 0,
  capabilities = [],
  currentUserName,
  entitlements = {},
  locale,
  logoutErrorLabel,
  logoutLabel,
  mode,
  navigationLabel,
  organizationLabel,
  organizationName,
  platformAccess = false,
  role,
  roleLabel,
  switchToPlatformLabel,
  text,
  userLabel,
}: AppNavigationProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    morePanelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !mobileNavRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [moreOpen]);
  const isControlRole = role === "owner" || role === "manager";
  const canUse = (capability: OperationalCapability) => role
    ? hasOperationalCapability({ capabilities, role }, capability)
    : false;
  const posNavigationItem = canUse("pos") && entitlementEnabled(entitlements, FEATURES.pos)
    ? { href: "/app/pos", label: text.pos, match: "/app/pos" }
    : null;
  const shopNavigationItem = canUse("pos")
    && entitlementEnabled(entitlements, FEATURES.pos)
    && entitlementEnabled(entitlements, FEATURES.shopTerminal)
    ? { href: "/app/shop", label: text.shop, match: "/app/shop" }
    : null;
  const counterNavigationItems = shopNavigationItem ? [shopNavigationItem] : posNavigationItem ? [posNavigationItem] : [];
  const navigationGroups: NavigationGroup[] = isControlRole
    ? [
        {
          items: [
            { href: "/app/control", label: text.controlCenter, match: "/app/control" },
            ...counterNavigationItems,
            { href: "/app/orders", label: text.orders, match: "/app/orders" },
          ],
          label: text.controlGroup,
        },
        {
          items: [
            { href: "/app/work", label: text.work, match: "/app/work" },
            { href: "/app/work/production", label: text.production, match: "/app/work/production" },
            { href: "/app/work/quality", label: text.quality, match: "/app/work/quality" },
            { href: "/app/work/deliveries", label: text.delivery, match: "/app/work/deliveries" },
            { href: "/app/warehouse", label: text.warehouse, match: "/app/warehouse" },
          ],
          label: text.workGroup,
        },
        {
          items: [
            { href: "/app/customers", label: text.customers, match: "/app/customers" },
            ...(entitlementEnabled(entitlements, FEATURES.billingInvoicing)
              ? [{ href: "/app/billing", label: text.billing, match: "/app/billing" }]
              : []),
            { href: "/app/accounting", label: text.accounting, match: "/app/accounting" },
            { href: "/app/services", label: text.services, match: "/app/services" },
            { href: "/app/settings", label: text.settings, match: "/app/settings", aliases: ["/app/staff"] },
          ],
          label: text.managementGroup,
        },
        {
          items: [
            { href: "/app/alerts", label: text.alerts, match: "/app/alerts", alertBadge: true },
            { href: "/app/daily-close", label: text.dailyClose, match: "/app/daily-close" },
          ],
          label: text.toolsGroup,
        },
      ]
    : [
        {
          items: [
            { href: "/app/work", label: text.work, match: "/app/work" },
            ...counterNavigationItems,
            ...(canUse("production")
              ? [{ href: "/app/work/production", label: text.production, match: "/app/work/production" }]
              : []),
            ...(canUse("quality")
              ? [{ href: "/app/work/quality", label: text.quality, match: "/app/work/quality" }]
              : []),
            ...(canUse("delivery")
              ? [{ href: "/app/work/deliveries", label: text.delivery, match: "/app/work/deliveries" }]
              : []),
          ],
          label: text.workGroup,
        },
      ];
  const navigationItems = navigationGroups.flatMap((group) => group.items);
  const activeItem =
    navigationItems.find((item) =>
      (item.match === "/app" || item.match === "/app/work"
        ? pathname === item.match
        : pathname.startsWith(item.match))
      || ("aliases" in item && item.aliases?.some((alias) => pathname.startsWith(alias)) === true),
    ) ?? navigationItems[0];
  const activeExperience = !isControlRole
    || activeItem.href === "/app/work"
    || activeItem.href.startsWith("/app/work/")
    ? text.workExperience
    : text.controlCenter;

  if (mode === "header") {
    return (
      <header className="dashboard-topbar sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur lg:px-8 lg:py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted lg:text-sm lg:normal-case">
              {activeExperience}
            </p>
            <p className="truncate text-lg font-semibold text-primary lg:text-2xl">
              {activeItem.label}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-xs font-medium text-muted">{organizationLabel}</p>
              <p className="text-sm font-semibold text-primary">{organizationName}</p>
              <p className="text-xs font-semibold uppercase text-secondary">{role}</p>
            </div>

            {currentUserName && logoutLabel ? (
              <details className="group relative lg:hidden">
                <summary
                  aria-label={`${userLabel}: ${currentUserName}`}
                  className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control border border-border bg-white px-3 py-2 text-primary shadow-sm transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
                >
                  <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24">
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                  <span className="max-w-24 truncate text-sm font-semibold sm:max-w-36">
                    {currentUserName}
                  </span>
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24">
                    <path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </summary>

                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-white p-4 shadow-luxury">
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-muted">{userLabel}</dt>
                      <dd className="mt-1 break-words font-semibold text-primary">
                        {currentUserName}
                      </dd>
                    </div>
                    {role ? (
                      <div>
                        <dt className="text-xs font-medium text-muted">{roleLabel}</dt>
                        <dd className="mt-1 font-semibold uppercase text-secondary">{role}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {isControlRole ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <Link
                        className="flex min-h-11 items-center justify-between rounded-control border border-border px-3 text-sm font-semibold !text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        href="/app/settings"
                        locale={locale}
                      >
                        {text.settings}<span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  ) : null}
                  {platformAccess && switchToPlatformLabel ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <Link
                        className="flex min-h-11 items-center justify-between rounded-control border border-border px-3 text-sm font-semibold !text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        href="/platform"
                        locale={locale}
                      >
                        {switchToPlatformLabel}<span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  ) : null}
                  <div className="mt-4 border-t border-border pt-4">
                    <LogoutButton
                      className="w-full"
                      errorLabel={logoutErrorLabel}
                      label={logoutLabel}
                      locale={locale}
                    />
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  if (mode === "mobile") {
    const primaryItems = isControlRole
      ? navigationItems.filter((item) => [
          "/app/control",
          "/app/shop",
          "/app/orders",
          "/app/pos",
          "/app/work",
        ].includes(item.href))
      : navigationItems;
    const primaryHrefs = new Set(primaryItems.map((item) => item.href));
    const moreGroups = isControlRole
      ? navigationGroups.map((group) => ({
          ...group,
          items: group.items.filter((item) => !primaryHrefs.has(item.href)),
        })).filter((group) => group.items.length > 0)
      : [];
    const moreActive = moreGroups.some((group) => group.items.some((item) => item.href === activeItem.href));
    const mobileItemCount = primaryItems.length + (isControlRole ? 1 : 0);

    return (
      <nav
        aria-label={navigationLabel}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_-8px_24px_rgb(15_59_46_/_0.08)] backdrop-blur-lg lg:hidden"
        ref={mobileNavRef}
      >
        {isControlRole && moreOpen ? (
          <div aria-label={text.more} className="absolute inset-x-2 bottom-[calc(100%+0.5rem)] max-h-[65vh] overflow-y-auto rounded-card border border-border bg-white p-3 shadow-luxury" id="mobile-more-destinations" ref={morePanelRef} role="region">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-semibold text-primary">{text.more}</h2>
              <button aria-label={text.closeMore} className="min-h-11 min-w-11 rounded-control text-xl text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => { setMoreOpen(false); moreButtonRef.current?.focus(); }} type="button">×</button>
            </div>
            {moreGroups.map((group) => <div className="mb-3" key={group.label}>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {group.items.map((item) => <Link aria-current={activeItem.href === item.href ? "page" : undefined} className={`flex min-h-11 items-center justify-between rounded-control px-3 text-sm font-semibold ${activeItem.href === item.href ? "bg-primary-soft !text-primary" : "!text-foreground hover:bg-primary-soft/50"}`} href={item.href} key={item.href} locale={locale} onClick={() => setMoreOpen(false)}>
                  <span className="flex items-center gap-3"><NavigationIcon href={item.href} />{item.label}</span>
                  {item.alertBadge && alertCount > 0 ? <span className="rounded-full bg-gold px-2 text-xs text-primary">{alertCount}</span> : null}
                </Link>)}
              </div>
            </div>)}
          </div>
        ) : null}
        <div className={`mx-auto grid max-w-lg gap-1 ${
          mobileItemCount === 1
            ? "grid-cols-1"
            : mobileItemCount === 2
              ? "grid-cols-2"
              : mobileItemCount === 3
                ? "grid-cols-3"
                : mobileItemCount === 5
                  ? "grid-cols-5"
                  : "grid-cols-4"
        }`}>
          {primaryItems.map((item) => {
            const isActive = item.href === activeItem.href;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-control px-0.5 text-center text-[0.68rem] font-semibold leading-tight transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-primary-soft !text-primary"
                    : "!text-muted hover:bg-[#f5f7f5] hover:!text-primary"
                }`}
                href={item.href}
                key={item.href}
                locale={locale}
                onClick={() => setMoreOpen(false)}
              >
                <NavigationIcon href={item.href} />
                <span className="line-clamp-2 max-w-full px-0.5">{item.label}</span>
                {item.alertBadge && alertCount > 0 ? (
                  <span className="absolute right-[calc(50%_-_1.45rem)] top-0.5 min-w-4 rounded-full bg-gold px-1 py-0.5 text-center text-[0.625rem] font-bold leading-none text-primary shadow-sm">
                    {alertCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
          {isControlRole ? <button aria-controls={moreOpen ? "mobile-more-destinations" : undefined} aria-expanded={moreOpen} aria-label={text.more} className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-control px-0.5 text-center text-[0.68rem] font-semibold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${moreOpen || moreActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-[#f5f7f5] hover:text-primary"}`} onClick={() => setMoreOpen((open) => !open)} ref={moreButtonRef} type="button">
            <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="7" r="1.8" /><circle cx="12" cy="7" r="1.8" /><circle cx="19" cy="7" r="1.8" /><circle cx="5" cy="17" r="1.8" /><circle cx="12" cy="17" r="1.8" /><circle cx="19" cy="17" r="1.8" /></svg>
            <span className="line-clamp-2 max-w-full px-0.5">{text.more}</span>
          </button> : null}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label={navigationLabel} className="space-y-6">
      {navigationGroups.map((group) => (
        <div className="space-y-2" key={group.label}>
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = item.href === activeItem.href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`block min-h-11 rounded-control px-3 py-2.5 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-primary-soft !text-primary ring-1 ring-inset ring-primary/10 hover:bg-[#e2eee8] hover:!text-primary"
                      : "!text-muted hover:bg-[#f5f7f5] hover:!text-primary"
                  }`}
                  href={item.href}
                  key={item.href}
                  locale={locale}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <NavigationIcon href={item.href} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </span>
                    {item.alertBadge && alertCount > 0 ? (
                      <span className="min-w-6 rounded-full bg-gold px-2 py-0.5 text-center text-xs font-semibold text-primary">
                        {alertCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
