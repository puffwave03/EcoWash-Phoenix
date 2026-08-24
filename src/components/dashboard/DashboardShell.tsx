import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { AppNavigation } from "@/components/dashboard/AppNavigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import type { PortalBrandPresentation } from "@/features/portal/media";
import type { DashboardAccess } from "@/lib/auth/types";

type DashboardShellText = {
  alerts: string;
  branding: string;
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
  organizationLabel: string;
  overview: string;
  production: string;
  quality: string;
  roleLabel: string;
  services: string;
  staff: string;
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
  locale: string;
  text: DashboardShellText;
};

export function DashboardShell({
  access,
  alertCount = 0,
  brand = {},
  children,
  locale,
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
    <main className="min-h-screen bg-background text-foreground" style={brandStyle}>
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside
          aria-label={text.navigationLabel}
          className="hidden flex-col justify-between border-r border-border bg-white px-4 py-5 lg:flex lg:min-h-screen"
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
              locale={locale}
              mode="desktop"
              navigationLabel={text.navigationLabel}
              role={access.membership.role}
              alertCount={alertCount}
              text={{
                alerts: text.alerts,
                branding: text.branding,
                controlCenter: text.controlCenter,
                controlGroup: text.controlGroup,
                customers: text.customers,
                dailyClose: text.dailyClose,
                delivery: text.delivery,
                managementGroup: text.managementGroup,
                orders: text.orders,
                overview: text.overview,
                production: text.production,
                quality: text.quality,
                services: text.services,
                staff: text.staff,
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
            alertCount={alertCount}
            text={{
              alerts: text.alerts,
              branding: text.branding,
              controlCenter: text.controlCenter,
              controlGroup: text.controlGroup,
              customers: text.customers,
              dailyClose: text.dailyClose,
              delivery: text.delivery,
              managementGroup: text.managementGroup,
              orders: text.orders,
              overview: text.overview,
              production: text.production,
              quality: text.quality,
              services: text.services,
              staff: text.staff,
              toolsGroup: text.toolsGroup,
              work: text.work,
              workExperience: text.workExperience,
              workGroup: text.workGroup,
            }}
            userLabel={text.userLabel}
          />

          <section className="px-4 py-5 pb-[calc(5.25rem_+_env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-7 lg:pb-10 xl:px-10">
            {children}
          </section>
        </div>
      </div>

      <AppNavigation
        capabilities={access.membership.capabilities}
        locale={locale}
        mode="mobile"
        navigationLabel={text.navigationLabel}
        role={access.membership.role}
        alertCount={alertCount}
        text={{
          alerts: text.alerts,
          branding: text.branding,
          controlCenter: text.controlCenter,
          controlGroup: text.controlGroup,
          customers: text.customers,
          dailyClose: text.dailyClose,
          delivery: text.delivery,
          managementGroup: text.managementGroup,
          orders: text.orders,
          overview: text.overview,
          production: text.production,
          quality: text.quality,
          services: text.services,
          staff: text.staff,
          toolsGroup: text.toolsGroup,
          work: text.work,
          workExperience: text.workExperience,
          workGroup: text.workGroup,
        }}
      />
    </main>
  );
}
