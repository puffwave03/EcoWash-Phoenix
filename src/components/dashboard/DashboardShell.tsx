import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
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
  return (
    <main className="min-h-screen bg-[#f4f7f5] py-8">
      <Container className="space-y-6">
        <header className="flex flex-col gap-4 rounded-card border border-border bg-white p-5 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
              {text.foundation}
            </p>
            <h1 className="text-2xl font-semibold text-primary">
              {access.membership.organization.name}
            </h1>
          </div>
          <LogoutButton label={text.logout} locale={locale} />
        </header>

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside
            aria-label={text.navigationLabel}
            className="rounded-card border border-border bg-white p-4 shadow-card"
          >
            <nav className="space-y-2">
              <Link
                className="block rounded-control bg-primary-soft px-4 py-3 text-sm font-semibold text-primary"
                href="/app"
                locale={locale}
              >
                {text.overview}
              </Link>
              <Link
                className="block rounded-control px-4 py-3 text-sm font-semibold text-primary transition-standard hover:bg-primary-soft"
                href="/app/customers"
                locale={locale}
              >
                {text.customers}
              </Link>
              <Link
                className="block rounded-control px-4 py-3 text-sm font-semibold text-primary transition-standard hover:bg-primary-soft"
                href="/app/orders"
                locale={locale}
              >
                {text.orders}
              </Link>
              <Link
                className="block rounded-control px-4 py-3 text-sm font-semibold text-primary transition-standard hover:bg-primary-soft"
                href="/app/services"
                locale={locale}
              >
                {text.services}
              </Link>
            </nav>
          </aside>

          <section className="space-y-6">
            <Card>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium text-muted">{text.userLabel}</dt>
                  <dd className="mt-1 text-base font-semibold text-primary">
                    {access.profile.displayName || access.user.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">
                    {text.organizationLabel}
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-primary">
                    {access.membership.organization.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">{text.roleLabel}</dt>
                  <dd className="mt-1 text-base font-semibold uppercase text-primary">
                    {access.membership.role}
                  </dd>
                </div>
              </dl>
            </Card>

            {children}
          </section>
        </div>
      </Container>
    </main>
  );
}
