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
            { href: "/app/production", label: text.production, match: "/app/production" },
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
            { href: "/app/production", label: text.production, match: "/app/production" },
            { href: "/app/delivery", label: text.delivery, match: "/app/delivery" },
          ],
          label: text.workGroup,
        },
      ];
  const navigationItems = navigationGroups.flatMap((group) => group.items);
  const activeItem =
    navigationItems.find((item) =>
      item.match === "/app" ? pathname === "/app" : pathname.startsWith(item.match),
    ) ?? navigationItems[0];
  const activeExperience = activeItem.href === "/app/work" || activeItem.href === "/app/production" || activeItem.href === "/app/delivery"
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/96 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-card backdrop-blur lg:hidden"
      >
        <div className={`grid gap-1 ${primaryItems.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {primaryItems.map((item) => {
            const isActive = item.href === activeItem.href;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center rounded-control px-1.5 text-center text-[0.68rem] font-semibold leading-tight transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-primary !text-white shadow-card hover:!text-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                    : "text-muted hover:bg-primary-soft hover:text-primary"
                }`}
                href={item.href}
                key={item.href}
                locale={locale}
              >
                <span className="min-w-0 truncate">{item.label}</span>
                {item.alertBadge && alertCount > 0 ? (
                  <span className={`ml-1 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] font-semibold ${
                    isActive ? "bg-white text-primary" : "bg-secondary text-primary"
                  }`}>
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
