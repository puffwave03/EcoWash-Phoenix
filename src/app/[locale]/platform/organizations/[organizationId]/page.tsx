import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformEntitlementForm } from "@/components/platform/PlatformEntitlementForm";
import { PlatformStatusForm } from "@/components/platform/PlatformStatusForm";
import { FEATURE_GROUP_ORDER, FEATURE_PRESENTATION, FEATURES, type FeatureKey } from "@/features/entitlements/feature-catalog";
import {
  savePlatformCommercialLabelAction,
  savePlatformEntitlementAction,
  savePlatformServiceStatusAction,
} from "@/features/platform-admin/server/actions";
import { getPlatformOrganizationDetail } from "@/features/platform-admin/server/queries";
import { Link } from "@/i18n/navigation";

export default async function PlatformOrganizationDetailPage({ params, searchParams }: {
  params: Promise<{ locale: string; organizationId: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ locale, organizationId }, result] = await Promise.all([params, searchParams]);
  const [{ audit, entitlements, summary }, t] = await Promise.all([
    getPlatformOrganizationDetail(locale, organizationId),
    getTranslations({ locale, namespace: "common.platform" }),
  ]);
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : t("detail.notSet");
  const disruptive = new Set<FeatureKey>([FEATURES.billingInvoicing, FEATURES.segmentPriceOverrides, FEATURES.fullWhiteLabel]);
  const groups = FEATURE_GROUP_ORDER.map((group) => ({
    group,
    items: entitlements.filter((item) => FEATURE_PRESENTATION[item.featureKey].group === group),
  })).filter((group) => group.items.length > 0);
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <Link className="text-sm font-semibold text-primary hover:underline" href="/platform/organizations" locale={locale}>← {t("detail.back")}</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{t("detail.eyebrow")}</p><h1 className="mt-2 text-3xl font-semibold text-primary">{summary.name}</h1><p className="mt-2 font-mono text-xs text-muted">{summary.id}</p></div>
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${summary.serviceStatus === "active" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{t(`status.${summary.serviceStatus}`)}</span>
        </div>
      </header>
      {result.result ? <p className={`rounded-control border p-3 text-sm font-medium ${result.result === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{t(`result.${result.result === "saved" ? "saved" : "error"}`)}</p> : null}
      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="bg-white"><h2 className="text-xl font-semibold text-primary">{t("detail.identity")}</h2><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted">{t("detail.created")}</dt><dd className="mt-1 font-medium text-primary">{formatDate(summary.createdAt)}</dd></div><div><dt className="text-muted">{t("detail.tenantState")}</dt><dd className="mt-1 font-medium text-primary">{t(`status.${summary.tenantStatus}`)}</dd></div></dl><form action={savePlatformCommercialLabelAction.bind(null, locale, organizationId)} className="mt-6 space-y-3 border-t border-border pt-5"><label className="block text-sm font-medium text-primary"><span>{t("detail.commercialLabel")}</span><input className="mt-1 min-h-11 w-full rounded-control border border-border px-3" defaultValue={summary.commercialPlanLabel ?? ""} maxLength={80} name="commercialPlanLabel" placeholder={t("detail.commercialPlaceholder")} /></label><p className="text-xs text-muted">{t("detail.commercialHelp")}</p><Button type="submit">{t("detail.saveLabel")}</Button></form></Card>
        <Card className="bg-white"><h2 className="text-xl font-semibold text-primary">{t("detail.serviceControl")}</h2><div className="mt-5"><PlatformStatusForm action={savePlatformServiceStatusAction.bind(null, locale, organizationId)} currentStatus={summary.serviceStatus} text={{ active: t("statusControl.active"), confirm: t("statusControl.confirm"), reactivate: t("statusControl.reactivate"), suspend: t("statusControl.suspend"), suspended: t("statusControl.suspended") }} /></div></Card>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(["members", "customers", "orders", "locations"] as const).map((key) => <Card className="bg-white" key={key}><p className="text-sm text-muted">{t(`usage.${key}`)}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-primary">{{ members: summary.memberCount, customers: summary.customerCount, orders: summary.orderCount, locations: summary.locationCount }[key]}</p></Card>)}
      </section>
      <Card className="bg-white"><h2 className="text-xl font-semibold text-primary">{t("branding.title")}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm"><div><dt className="text-muted">{t("branding.commercialName")}</dt><dd className="mt-1 font-medium text-primary">{summary.brandingCommercialName ?? t("detail.notSet")}</dd></div><div><dt className="text-muted">{t("branding.logo")}</dt><dd className="mt-1 font-medium text-primary">{summary.brandingHasLogo ? t("common.yes") : t("common.no")}</dd></div><div><dt className="text-muted">{t("branding.advanced")}</dt><dd className="mt-1 font-medium text-primary">{entitlements.find((item) => item.featureKey === FEATURES.fullWhiteLabel)?.effectiveEnabled ? t("common.yes") : t("common.no")}</dd></div></dl></Card>
      <section className="space-y-5"><div><h2 className="text-2xl font-semibold text-primary">{t("entitlements.title")}</h2><p className="mt-2 text-sm text-muted">{t("entitlements.description")}</p></div>{groups.map(({ group, items }) => <div className="space-y-3" key={group}><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{t(`features.groups.${group}`)}</h3>{items.map((entitlement) => <Card className="bg-white" key={entitlement.featureKey}><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-primary">{t(`features.labels.${FEATURE_PRESENTATION[entitlement.featureKey].labelKey}`)}</h4><p className="mt-1 font-mono text-xs text-muted">{entitlement.featureKey}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entitlement.effectiveEnabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{entitlement.effectiveEnabled ? t("entitlements.included") : t("entitlements.notIncluded")}</span></div><PlatformEntitlementForm action={savePlatformEntitlementAction.bind(null, locale, organizationId)} disruptive={disruptive.has(entitlement.featureKey)} entitlement={entitlement} text={{ confirm: t("entitlements.confirmDisable"), disable: t("entitlements.disable"), enable: t("entitlements.enable"), limit: t("entitlements.limit"), save: t("entitlements.save"), source: t("entitlements.source"), validFrom: t("entitlements.validFrom"), validUntil: t("entitlements.validUntil") }} /></Card>)}</div>)}</section>
      <Card className="bg-white"><h2 className="text-xl font-semibold text-primary">{t("audit.title")}</h2>{audit.length === 0 ? <p className="mt-4 text-sm text-muted">{t("audit.empty")}</p> : <div className="mt-4 divide-y divide-border">{audit.map((entry) => <article className="py-4 first:pt-0 last:pb-0" key={entry.id}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-primary">{t(`audit.actions.${entry.action}`)} · {entry.target}</p><time className="text-xs text-muted">{formatDate(entry.createdAt)}</time></div><p className="mt-1 text-xs text-muted">{entry.actorDisplayName}</p></article>)}</div>}</Card>
    </div>
  );
}
