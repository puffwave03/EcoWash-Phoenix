import type { ReactNode } from "react";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { Link } from "@/i18n/navigation";
import type { DashboardAccess } from "@/lib/auth/types";

type DashboardShellText = {
  foundation: string;
  logout: string;
  navigationLabel: string;
  customers: string;
  orders: string;
  organizationLabel: string;
  overview: string;
  roleLabel: string;
  services: string;
  userLabel: string;
};

type DashboardShellProps = {
  access: DashboardAccess;
  children: ReactNode;
  locale: string;
  text: DashboardShellText;
};

export function DashboardShell({
  access,
  children,
  locale,
  text,
}: DashboardShellProps) {
  const navLinkClass = "block rounded-control px-3 py-2.5 text-sm font-semibold text-white/80 transition-standard hover:bg-white/10 hover:text-white";

  return (
    <main className="min-h-screen bg-[#eef1ee] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside
          aria-label={text.navigationLabel}
          className="flex flex-col justify-between bg-[#09291f] px-5 py-5 text-white lg:min-h-screen"
        >
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-logo bg-secondary text-base font-semibold text-primary">
                EW
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-white/58">
                  {text.foundation}
                </p>
                <h1 className="mt-1 text-xl font-semibold text-white">
                  {access.membership.organization.name}
                </h1>
              </div>
            </div>

            <nav className="space-y-1">
              <Link
                className="block rounded-control bg-white px-3 py-2.5 text-sm font-semibold text-primary shadow-card"
                href="/app"
                locale={locale}
              >
                {text.overview}
              </Link>
              <Link
                className={navLinkClass}
                href="/app/customers"
                locale={locale}
              >
                {text.customers}
              </Link>
              <Link
                className={navLinkClass}
                href="/app/orders"
                locale={locale}
              >
                {text.orders}
              </Link>
              <Link
                className={navLinkClass}
                href="/app/services"
                locale={locale}
              >
                {text.services}
              </Link>
            </nav>
          </div>

          <div className="mt-8 space-y-4 border-t border-white/12 pt-5">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-white/54">{text.userLabel}</dt>
                <dd className="mt-1 font-semibold text-white">
                  {access.profile.displayName || access.user.email}
                </dd>
              </div>
              <div>
                <dt className="text-white/54">{text.roleLabel}</dt>
                <dd className="mt-1 font-semibold uppercase text-secondary">
                  {access.membership.role}
                </dd>
              </div>
            </dl>
            <LogoutButton label={text.logout} locale={locale} />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-border bg-white px-5 py-4 lg:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted">{text.organizationLabel}</p>
                <p className="text-2xl font-semibold text-primary">
                  {access.membership.organization.name}
                </p>
              </div>
              <p className="text-sm font-semibold uppercase text-secondary">
                {text.overview}
              </p>
            </div>
          </header>

          <section className="px-5 py-6 lg:px-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
