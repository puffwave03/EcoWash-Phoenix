import type { ReactNode } from "react";
import { AppNavigation } from "@/components/dashboard/AppNavigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
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
    <main className="min-h-screen bg-[#eef1ee] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside
          aria-label={text.navigationLabel}
          className="hidden flex-col justify-between bg-[#09291f] px-5 py-5 text-white lg:flex lg:min-h-screen"
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

            <AppNavigation
              locale={locale}
              mode="desktop"
              navigationLabel={text.navigationLabel}
              text={{
                customers: text.customers,
                orders: text.orders,
                overview: text.overview,
                services: text.services,
              }}
            />
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
          <AppNavigation
            locale={locale}
            mode="header"
            navigationLabel={text.navigationLabel}
            organizationLabel={text.organizationLabel}
            organizationName={access.membership.organization.name}
            role={access.membership.role}
            text={{
              customers: text.customers,
              orders: text.orders,
              overview: text.overview,
              services: text.services,
            }}
          />

          <section className="px-4 py-5 pb-24 sm:px-5 lg:px-8 lg:py-6 lg:pb-8">
            {children}
          </section>
        </div>
      </div>

      <AppNavigation
        locale={locale}
        mode="mobile"
        navigationLabel={text.navigationLabel}
        text={{
          customers: text.customers,
          orders: text.orders,
          overview: text.overview,
          services: text.services,
        }}
      />
    </main>
  );
}
