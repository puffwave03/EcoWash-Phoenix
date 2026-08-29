import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import {
  entitlementEnabled,
  FEATURES,
} from "@/features/entitlements/feature-catalog";
import { getCurrentEntitlements } from "@/features/entitlements/server/resolver";
import { Link } from "@/i18n/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

type SettingsItem = {
  description: string;
  href: string;
  title: string;
};

export default async function SettingsPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [access, entitlements, t] = await Promise.all([
    requireOwnerOrManager(locale),
    getCurrentEntitlements(locale, [
      FEATURES.billingInvoicing,
      FEATURES.fullWhiteLabel,
      FEATURES.printing,
    ]),
    getTranslations({ locale, namespace: "common.settings" }),
  ]);
  const isOwner = access.membership.role === "owner";
  const groups: Array<{ description: string; id: string; items: SettingsItem[]; title: string }> = [
    {
      description: t("groups.company.description"),
      id: "company",
      items: isOwner && entitlementEnabled(entitlements, FEATURES.billingInvoicing)
        ? [{
            description: t("items.billingIssuer.description"),
            href: "/app/billing#issuer-settings",
            title: t("items.billingIssuer.title"),
          }]
        : [],
      title: t("groups.company.title"),
    },
    {
      description: t("groups.appearance.description"),
      id: "appearance",
      items: isOwner && entitlementEnabled(entitlements, FEATURES.fullWhiteLabel)
        ? [{
            description: t("items.brandPortal.description"),
            href: "/app/settings/branding",
            title: t("items.brandPortal.title"),
          }]
        : [],
      title: t("groups.appearance.title"),
    },
    {
      description: t("groups.operations.description"),
      id: "operations",
      items: [
        {
          description: t("items.catalog.description"),
          href: "/app/settings/catalog",
          title: t("items.catalog.title"),
        },
        ...(entitlementEnabled(entitlements, FEATURES.printing)
          ? [{
              description: t("items.printers.description"),
              href: "/app/settings/printers",
              title: t("items.printers.title"),
            }]
          : []),
      ],
      title: t("groups.operations.title"),
    },
    {
      description: t("groups.people.description"),
      id: "people",
      items: isOwner
        ? [{
            description: t("items.staff.description"),
            href: "/app/staff",
            title: t("items.staff.title"),
          }]
        : [],
      title: t("groups.people.title"),
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        description={t("description")}
        eyebrow={t("eyebrow")}
        title={t("title")}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {groups.filter((group) => group.items.length > 0).map((group) => (
          <section aria-labelledby={`settings-${group.id}`} key={group.id}>
            <Card className="h-full bg-white">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-primary" id={`settings-${group.id}`}>
                  {group.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">{group.description}</p>
              </div>
              <div className="mt-2 divide-y divide-border">
                {group.items.map((item) => (
                  <Link
                    className="group flex min-h-16 items-center justify-between gap-4 rounded-control px-2 py-3 !text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    href={item.href}
                    key={item.href}
                    locale={locale}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{item.title}</span>
                      <span className="mt-0.5 block text-sm font-normal leading-5 text-muted">{item.description}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-lg transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                ))}
              </div>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
