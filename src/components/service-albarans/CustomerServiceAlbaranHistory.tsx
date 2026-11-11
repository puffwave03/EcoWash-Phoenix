import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { EmptyState, StatusBadge } from "@/components/operational/OperationalUi";
import { accountHistoryHref } from "@/features/customer-account/pagination";
import type { CustomerAccountPeriod } from "@/features/customer-account/types";
import { getCustomerServiceAlbaranHistory } from "@/features/service-albarans/server/customer-history-queries";
import { Link } from "@/i18n/navigation";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export async function CustomerServiceAlbaranHistory({ locale, customerId, page, period, orderCursor, paymentCursor }: {
  locale: string;
  customerId: string;
  page?: string;
  period: CustomerAccountPeriod;
  orderCursor: string | null;
  paymentCursor: string | null;
}) {
  const history = await getCustomerServiceAlbaranHistory(locale, customerId, page);
  if (history.state === "hidden") return null;
  const t = await getTranslations({ locale, namespace: "common.serviceAlbarans" });
  const href = (targetPage: number) => {
    const base = accountHistoryHref(customerId, period, orderCursor, paymentCursor);
    const query = new URLSearchParams(base.split("?")[1]);
    if (targetPage > 1) query.set("albaranPage", String(targetPage));
    return `/app/customers/${customerId}?${query.toString()}#customer-service-albarans`;
  };
  const linkClass = "inline-flex min-h-11 items-center justify-center rounded-control border border-border px-3 text-sm font-semibold !text-primary hover:bg-primary-soft";

  return <section className="scroll-mt-24 space-y-4" id="customer-service-albarans" aria-labelledby="customer-service-albarans-title">
    <div>
      <h2 className="text-xl font-semibold text-primary" id="customer-service-albarans-title">{t("register.title")}</h2>
      <p className="mt-2 text-sm text-muted">{t("notFiscal")}</p>
    </div>
    {history.state !== "ready" ? <Card className="border-amber-200 bg-amber-50">
      <p role="alert" className="text-sm font-semibold text-amber-900">{t("customerHistory.unavailable")}</p>
      <a className={`${linkClass} mt-3`} href={`/${locale}${href(1)}`}>{t("register.reload")}</a>
    </Card> : <>
      {history.items.length === 0 ? <EmptyState>{t("customerHistory.empty")}</EmptyState> : <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white shadow-card">
        {history.items.map((document) => <article key={document.id} className="grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_auto_auto] sm:items-center sm:p-5">
          <div className="min-w-0">
            <Link className="break-words text-lg font-semibold !text-primary hover:underline" locale={locale} href={`/app/orders/${document.order_id}/albarans/${document.id}/print`}>{document.document_number}</Link>
            <p className="mt-1 text-sm text-muted">{t("issuedAt")}: {formatOrganizationDateTime(document.issued_at, locale, history.timeZone)}</p>
          </div>
          <Link className="break-words text-sm font-semibold !text-primary underline" locale={locale} href={`/app/orders/${document.order_id}`}>{t("order")}: {document.order_number}</Link>
          <div><StatusBadge tone={document.document_status === "issued" ? "success" : "neutral"}>{t(document.document_status)}</StatusBadge></div>
          <Link className={linkClass} locale={locale} href={`/app/orders/${document.order_id}/albarans/${document.id}/print`}>{t("register.openA4")}</Link>
        </article>)}
      </div>}
      <nav aria-label={t("register.pagination")} className="flex flex-wrap items-center gap-3">
        {history.page > 1 ? <Link className={linkClass} locale={locale} href={href(history.page - 1)}>{t("register.previous")}</Link> : null}
        <span className="text-sm text-muted">{t("register.page", { page: history.page, pages: history.pages })}</span>
        {history.page < history.pages ? <Link className={linkClass} locale={locale} href={href(history.page + 1)}>{t("register.next")}</Link> : null}
      </nav>
    </>}
  </section>;
}
