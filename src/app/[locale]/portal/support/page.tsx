import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import { getTenantBranding } from "@/features/branding/server/queries";
import { requireCustomerPortalAccess } from "@/features/portal/server/queries";

type CustomerPortalSupportPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CustomerPortalSupportPage({
  params,
}: CustomerPortalSupportPageProps) {
  const { locale } = await params;
  const access = await requireCustomerPortalAccess(locale);
  const [branding, t] = await Promise.all([
    getTenantBranding(access.organizationId),
    getTranslations({ locale, namespace: "common.portal" }),
  ]);
  const phoneHref = branding.support.phone?.replace(/[^+0-9]/g, "") ?? "";
  const whatsappNumber = branding.support.whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const hasContacts = Boolean(
    branding.support.email
    || phoneHref
    || whatsappNumber
    || branding.support.address,
  );

  return (
    <CustomerPortalShell
      brand={branding.brand}
      customerName={access.customerName}
      locale={locale}
      text={{
        assistance: t("assistance"),
        logout: t("logout"),
        navigationLabel: t("navigationLabel"),
        newRequest: t("request.nav"),
        orders: t("orders"),
        overview: t("overview"),
        profile: t("profile"),
        title: t("title"),
      }}
    >
      <div className="mx-auto max-w-3xl space-y-6" data-portal-support-page>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            {t("support.eyebrow")}
          </p>
          <h1 className="text-3xl font-semibold text-primary sm:text-4xl">
            {t("support.title")}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted">
            {t("support.description")}
          </p>
        </header>

        <Card className="space-y-5">
          {branding.brand.name ? (
            <h2 className="text-xl font-semibold text-primary">{branding.brand.name}</h2>
          ) : null}
          <div className="flex flex-wrap gap-3 text-sm">
            {branding.support.email ? (
              <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={`mailto:${branding.support.email}`}>
                {branding.support.email}
              </a>
            ) : null}
            {phoneHref ? (
              <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={`tel:${phoneHref}`}>
                {branding.support.phone}
              </a>
            ) : null}
            {whatsappNumber ? (
              <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={`https://wa.me/${whatsappNumber}`} rel="noreferrer" target="_blank">
                {t("whatsapp")}
              </a>
            ) : null}
          </div>
          {branding.support.address ? (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("support.address")}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{branding.support.address}</p>
            </div>
          ) : null}
          {!hasContacts ? <p className="text-sm leading-6 text-muted">{t("support.noContacts")}</p> : null}
        </Card>
      </div>
    </CustomerPortalShell>
  );
}
