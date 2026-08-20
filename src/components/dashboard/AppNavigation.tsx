"use client";

import { Link, usePathname } from "@/i18n/navigation";

type AppNavigationText = {
  alerts: string;
  controlCenter: string;
  controlGroup: string;
  customers: string;
  dailyClose: string;
  delivery: string;
  managementGroup: string;
  orders: string;
  overview: string;
  production: string;
  quality: string;
  services: string;
  staff: string;
  toolsGroup: string;
  work: string;
  workExperience: string;
  workGroup: string;
};

type AppNavigationProps = {
  alertCount?: number;
  locale: string;
  mode: "desktop" | "header" | "mobile";
  navigationLabel: string;
  organizationLabel?: string;
  organizationName?: string;
  role?: string;
  text: AppNavigationText;
};

function NavigationIcon({ href }: { href: string }) {
  const iconClasses = "h-5 w-5";

  if (href === "/app") {
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

  if (href === "/app/delivery") {
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
  locale,
  mode,
  navigationLabel,
  organizationLabel,
  organizationName,
  role,
  text,
}: AppNavigationProps) {
  const pathname = usePathname();
  const isControlRole = role === "owner" || role === "manager";
  const navigationGroups = isControlRole
    ? [
        {
          items: [
            { href: "/app", label: text.overview, match: "/app" },
            { href: "/app/orders", label: text.orders, match: "/app/orders" },
          ],
          label: text.controlGroup,
        },
        {
          items: [
            { href: "/app/work", label: text.work, match: "/app/work" },
            { href: "/app/work/production", label: text.production, match: "/app/work/production" },
            { href: "/app/work/quality", label: text.quality, match: "/app/work/quality" },
            { href: "/app/delivery", label: text.delivery, match: "/app/delivery" },
          ],
          label: text.workGroup,
        },
        {
          items: [
            { href: "/app/customers", label: text.customers, match: "/app/customers" },
            { href: "/app/services", label: text.services, match: "/app/services" },
            { href: "/app/staff", label: text.staff, match: "/app/staff" },
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
            { href: "/app/work/production", label: text.production, match: "/app/work/production" },
            { href: "/app/work/quality", label: text.quality, match: "/app/work/quality" },
            { href: "/app/delivery", label: text.delivery, match: "/app/delivery" },
          ],
          label: text.workGroup,
        },
      ];
  const navigationItems = navigationGroups.flatMap((group) => group.items);
  const activeItem =
    navigationItems.find((item) =>
      item.match === "/app" || item.match === "/app/work"
        ? pathname === item.match
        : pathname.startsWith(item.match),
    ) ?? navigationItems[0];
  const activeExperience = activeItem.href === "/app/work" || activeItem.href === "/app/work/production" || activeItem.href === "/app/work/quality" || activeItem.href === "/app/delivery"
    ? text.workExperience
    : text.controlCenter;

  if (mode === "header") {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur lg:px-8 lg:py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted lg:text-sm lg:normal-case">
              {activeExperience}
            </p>
            <p className="truncate text-lg font-semibold text-primary lg:text-2xl">
              {activeItem.label}
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-muted">{organizationLabel}</p>
            <p className="text-sm font-semibold text-primary">{organizationName}</p>
            <p className="text-xs font-semibold uppercase text-secondary">{role}</p>
          </div>
        </div>
      </header>
    );
  }

  if (mode === "mobile") {
    const primaryItems = isControlRole
      ? navigationItems.filter((item) => ["/app", "/app/orders", "/app/work", "/app/alerts"].includes(item.href))
      : navigationItems;

    return (
      <nav
        aria-label={navigationLabel}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_-8px_24px_rgb(15_59_46_/_0.08)] backdrop-blur-lg lg:hidden"
      >
        <div className={`mx-auto grid max-w-lg gap-1 ${primaryItems.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {primaryItems.map((item) => {
            const isActive = item.href === activeItem.href;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-center text-xs font-semibold leading-none transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-[#f5f7f5] hover:text-primary"
                }`}
                href={item.href}
                key={item.href}
                locale={locale}
              >
                <NavigationIcon href={item.href} />
                <span className="block max-w-full truncate px-0.5">{item.label}</span>
                {item.alertBadge && alertCount > 0 ? (
                  <span className="absolute right-[calc(50%_-_1.45rem)] top-0.5 min-w-4 rounded-full bg-secondary px-1 py-0.5 text-center text-[0.625rem] font-bold leading-none text-primary shadow-sm">
                    {alertCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label={navigationLabel} className="space-y-6">
      {navigationGroups.map((group) => (
        <div className="space-y-2" key={group.label}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-white/48">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = item.href === activeItem.href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`block min-h-11 rounded-control px-3 py-2.5 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-[#09291f] ${
                    isActive ? "bg-white text-primary shadow-card" : "text-white/78 hover:bg-white/10 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                  locale={locale}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>{item.label}</span>
                    {item.alertBadge && alertCount > 0 ? (
                      <span className="min-w-6 rounded-full bg-secondary px-2 py-0.5 text-center text-xs font-semibold text-primary">
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
