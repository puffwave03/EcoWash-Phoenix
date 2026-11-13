import { getTranslations } from "next-intl/server";
import { getBillingOrderEntry } from "@/features/billing/server/order-entry";
import { Link } from "@/i18n/navigation";
import { fiscalTicketEnabled } from "@/features/billing/server/fiscal-ticket-queries";

export async function BillingOrderEntry({ locale, orderId }: { locale: string; orderId: string }) {
  const [entry, t, ticketEnabled] = await Promise.all([
    getBillingOrderEntry(locale, orderId),
    getTranslations({ locale, namespace: "common.billing.entry" }),
    fiscalTicketEnabled(locale),
  ]);
  const ticketLink = ticketEnabled ? <Link className="inline-flex min-h-12 items-center rounded-control bg-white px-5 py-2.5 font-semibold !text-primary" href={`/app/billing/full-prepayment?orderId=${encodeURIComponent(orderId)}`} locale={locale}>{t("fullPrepaymentTicket")}</Link> : null;
  if (entry.kind === "unavailable") {
    const message = <p className="max-w-sm text-sm text-white/80">{t(entry.reason)}</p>;
    return ticketLink ? <div className="flex flex-wrap gap-2">{message}{ticketLink}</div> : message;
  }
  const ordinaryLink = (
    <Link className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-white px-5 py-2.5 text-sm font-semibold !text-primary lg:w-auto" href={entry.href} locale={locale}>
      {t(entry.kind)}
    </Link>
  );
  return ticketLink ? <div className="flex flex-wrap gap-2">{ordinaryLink}{ticketLink}</div> : ordinaryLink;
}
