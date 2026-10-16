import { getTranslations } from "next-intl/server";
import { getBillingOrderEntry } from "@/features/billing/server/order-entry";
import { Link } from "@/i18n/navigation";

export async function BillingOrderEntry({ locale, orderId }: { locale: string; orderId: string }) {
  const [entry, t] = await Promise.all([
    getBillingOrderEntry(locale, orderId),
    getTranslations({ locale, namespace: "common.billing.entry" }),
  ]);
  if (entry.kind === "unavailable") {
    return <p className="max-w-sm text-sm text-white/80">{t(entry.reason)}</p>;
  }
  return (
    <Link className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-white px-5 py-2.5 text-sm font-semibold !text-primary lg:w-auto" href={entry.href} locale={locale}>
      {t(entry.kind)}
    </Link>
  );
}
