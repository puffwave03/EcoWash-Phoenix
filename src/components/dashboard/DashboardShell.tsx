import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { AppNavigation } from "@/components/dashboard/AppNavigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import type { PortalBrandPresentation } from "@/features/portal/media";
import type { DashboardAccess } from "@/lib/auth/types";
import type { EntitlementAccess } from "@/features/entitlements/feature-catalog";
import { Link } from "@/i18n/navigation";

type DashboardShellText = {
  accounting: string;
  alerts: string;
  billing: string;
  controlCenter: string;
  controlGroup: string;
  dailyClose: string;
  delivery: string;
  foundation: string;
  logout: string;
  logoutError: string;
  managementGroup: string;
  navigationLabel: string;
  customers: string;
  orders: string;
  pos: string;
  organizationLabel: string;
  overview: string;
  production: string;
  quality: string;
  roleLabel: string;
  services: string;
  shop: string;
  settings: string;
  switchToPlatform: string;
  toolsGroup: string;
  userLabel: string;
  work: string;
  workExperience: string;
  workGroup: string;
};

type DashboardShellProps = {
  access: DashboardAccess;
  alertCount?: number;
  brand?: PortalBrandPresentation;
  children: ReactNode;
  entitlements?: EntitlementAccess;
  locale: string;
  platformAccess?: boolean;
  text: DashboardShellText;
};

export function DashboardShell({
  access,
  alertCount = 0,
  brand = {},
  children,
  entitlements = {},
  locale,
  platformAccess = false,
  text,
}: DashboardShellProps) {
  const currentUserName = access.profile.displayName || access.user.email || text.userLabel;
  const organizationName = brand.name ?? access.membership.organization.name;
  const brandStyle = {
    ...(brand.primaryColor ? { "--color-primary": brand.primaryColor } : {}),
    ...(brand.primarySoftColor ? { "--color-primary-soft": brand.primarySoftColor } : {}),
    ...(brand.primaryStrongColor ? { "--color-primary-strong": brand.primaryStrongColor } : {}),
  } as CSSProperties;
  const initials = organizationName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="dashboard-shell min-h-screen bg-background text-foreground" style={brandStyle}>
      <div className="dashboard-grid grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside
          aria-label={text.navigationLabel}
          className="dashboard-desktop-nav hidden flex-col justify-between border-r border-border bg-white px-4 py-5 lg:flex lg:min-h-screen"
        >
          <div className="space-y-8">
            <div className="space-y-3">
              <div className={`flex h-11 items-center justify-center overflow-hidden rounded-logo bg-primary-soft text-base font-semibold text-primary ring-1 ring-inset ring-primary/10 ${brand.logoPath ? "w-20 px-2" : "w-11"}`}>
                {brand.logoPath ? (
                  <Image
                    alt={brand.logoAlt ?? ""}
                    className="h-9 w-full object-contain"
                    height={44}
                    sizes="80px"
                    src={brand.logoPath}
                    unoptimized={/^https?:\/\//.test(brand.logoPath)}
                    width={96}
                  />
                ) : initials}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {text.foundation}
                </p>
                <h1 className="mt-1 text-xl font-semibold text-foreground">
                  {organizationName}
                </h1>
              </div>
            </div>

            <AppNavigation
              capabilities={access.membership.capabilities}
              entitlements={entitlements}
              locale={locale}
              mode="desktop"
              navigationLabel={text.navigationLabel}
              role={access.membership.role}
              alertCount={alertCount}
              text={{
                accounting: text.accounting,
                alerts: text.alerts,
                billing: text.billing,
                controlCenter: text.controlCenter,
                controlGroup: text.controlGroup,
                customers: text.customers,
                dailyClose: text.dailyClose,
                delivery: text.delivery,
                managementGroup: text.managementGroup,
                orders: text.orders,
                pos: text.pos,
                overview: text.overview,
                production: text.production,
                quality: text.quality,
                services: text.services,
                shop: text.shop,
                settings: text.settings,
                toolsGroup: text.toolsGroup,
                work: text.work,
                workExperience: text.workExperience,
                workGroup: text.workGroup,
              }}
            />
          </div>

          <div className="mt-8 space-y-4 border-t border-border pt-5">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">{text.userLabel}</dt>
                <dd className="mt-1 break-words font-semibold text-foreground">
                  {currentUserName}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{text.roleLabel}</dt>
                <dd className="mt-1 font-semibold uppercase text-secondary">
                  {access.membership.role}
                </dd>
              </div>
            </dl>
            {platformAccess ? (
              <Link
                className="flex min-h-11 items-center justify-between rounded-control border border-border px-3 text-sm font-semibold !text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                href="/platform"
                locale={locale}
              >
                {text.switchToPlatform}<span aria-hidden="true">→</span>
              </Link>
            ) : null}
            <LogoutButton
              className="w-full"
              errorLabel={text.logoutError}
              label={text.logout}
              locale={locale}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <AppNavigation
            capabilities={access.membership.capabilities}
            entitlements={entitlements}
            currentUserName={currentUserName}
            locale={locale}
            logoutErrorLabel={text.logoutError}
            logoutLabel={text.logout}
            mode="header"
            navigationLabel={text.navigationLabel}
            organizationLabel={text.organizationLabel}
            organizationName={organizationName}
            role={access.membership.role}
            roleLabel={text.roleLabel}
            platformAccess={platformAccess}
            switchToPlatformLabel={text.switchToPlatform}
            alertCount={alertCount}
            text={{
              accounting: text.accounting,
              alerts: text.alerts,
              billing: text.billing,
              controlCenter: text.controlCenter,
              controlGroup: text.controlGroup,
              customers: text.customers,
              dailyClose: text.dailyClose,
              delivery: text.delivery,
              managementGroup: text.managementGroup,
              orders: text.orders,
              pos: text.pos,
              overview: text.overview,
              production: text.production,
              quality: text.quality,
              services: text.services,
              shop: text.shop,
              settings: text.settings,
              toolsGroup: text.toolsGroup,
              work: text.work,
              workExperience: text.workExperience,
              workGroup: text.workGroup,
            }}
            userLabel={text.userLabel}
          />

          <section className="dashboard-content px-4 py-5 pb-[calc(5.25rem_+_env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-7 lg:pb-10 xl:px-10">
            {children}
          </section>
        </div>
      </div>

      <AppNavigation
        capabilities={access.membership.capabilities}
        entitlements={entitlements}
        locale={locale}
        mode="mobile"
        navigationLabel={text.navigationLabel}
        role={access.membership.role}
        alertCount={alertCount}
        text={{
          accounting: text.accounting,
          alerts: text.alerts,
          billing: text.billing,
          controlCenter: text.controlCenter,
          controlGroup: text.controlGroup,
          customers: text.customers,
          dailyClose: text.dailyClose,
          delivery: text.delivery,
          managementGroup: text.managementGroup,
          orders: text.orders,
          pos: text.pos,
          overview: text.overview,
          production: text.production,
          quality: text.quality,
          services: text.services,
          shop: text.shop,
          settings: text.settings,
          toolsGroup: text.toolsGroup,
          work: text.work,
          workExperience: text.workExperience,
          workGroup: text.workGroup,
        }}
      />
    </main>
  );
}
