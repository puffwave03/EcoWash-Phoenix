import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { AlbaranSubmitButton } from "@/components/service-albarans/AlbaranSubmitButton";
import type { Order } from "@/features/orders/types";
import { cancelServiceAlbaranAction, issueServiceAlbaranAction } from "@/features/service-albarans/server/actions";
import { getOrderServiceAlbarans } from "@/features/service-albarans/server/queries";
import { Link } from "@/i18n/navigation";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export async function ServiceAlbaranPanel({ locale, order, hasItems, canCancel, error }: {
  locale: string;
  order: Pick<Order, "id" | "customerId" | "productionStatus" | "isActive" | "locationId">;
  hasItems: boolean;
  canCancel: boolean;
  error: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "common.serviceAlbarans" });
  const result = await getOrderServiceAlbarans(locale, order.id, order.customerId);
  return <section className="scroll-mt-24 space-y-4" id="service-albarans">
    <h3 className="text-xl font-semibold text-primary">{t("title")}</h3>
    <Card>
      <p className="text-sm text-muted">{t("notFiscal")}</p>
      {error ? <p className="mt-3 font-semibold text-red-800" role="alert">{t("error")}</p> : null}
      {!result.available ? <p className="mt-3 font-semibold text-amber-900" role="alert">{t("unavailable")}</p> : <>
        {!result.documents.some((document) => document.document_status === "issued") ? (
          result.businessCustomer && order.isActive && order.productionStatus === "completed" && order.locationId && hasItems
            ? <form action={issueServiceAlbaranAction.bind(null, locale, order.id)} className="mt-4">
              <input name="requestId" type="hidden" value={randomUUID()} />
              <input name="previousAlbaranId" type="hidden" value={result.documents[0]?.id ?? ""} />
              <AlbaranSubmitButton label={t("issue")} />
            </form>
            : <p className="mt-3 text-sm text-muted">{t("eligibility")}</p>
        ) : null}
        {result.documents.length === 0 ? <p className="mt-3 text-sm text-muted">{t("empty")}</p> : <ul className="mt-4 space-y-4">
          {result.documents.map((document) => <li className="space-y-2 border-t border-border pt-3" key={document.id}>
            <Link className="font-bold !text-primary underline" href={`/app/orders/${order.id}/albarans/${document.id}/print`} locale={locale}>{document.document_number} · {t(document.document_status)}</Link>
            <p className="text-sm text-muted">{formatOrganizationDateTime(document.issued_at, locale, document.snapshot.organization.timezone)}</p>
            {document.cancellation_reason ? <p className="break-words text-sm text-muted">{t("reason")}: {document.cancellation_reason}</p> : null}
            {canCancel && document.document_status === "issued" ? <form action={cancelServiceAlbaranAction.bind(null, locale, order.id, document.id)} className="flex flex-wrap items-end gap-3">
              <label className="block space-y-1 text-sm font-semibold text-primary"><span>{t("reason")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" maxLength={500} name="reason" required /></label>
              <AlbaranSubmitButton destructive label={t("cancel")} />
            </form> : null}
          </li>)}
        </ul>}
      </>}
    </Card>
  </section>;
}
