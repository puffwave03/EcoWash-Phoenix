import { getTranslations } from "next-intl/server";
import { PrintButton } from "@/components/printing/PrintButton";
import type { ServiceAlbaran } from "@/features/service-albarans/types";
import { Link } from "@/i18n/navigation";
import { formatQuantity } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export async function ServiceAlbaranDocument({ locale, albaran }: { locale: string; albaran: ServiceAlbaran }) {
  const t = await getTranslations({ locale, namespace: "common.serviceAlbarans" });
  const unitT = await getTranslations({ locale, namespace: "common.print.units" });
  // Explicit projection: no whole order, financial context, operator or notes.
  const { document, organization, location, customer, property, order, completion, items } = albaran.snapshot;
  return <div className="order-print-document order-print-ticket">
    <div className="print-preview-toolbar print:hidden"><div className="print-preview-actions">
      <Link className="font-bold !text-primary" href={`/app/orders/${albaran.order_id}#service-albarans`} locale={locale}>← {t("back")}</Link>
      <PrintButton label={t("print")} />
    </div></div>
    <article className="print-sheet print-ticket-sheet">
      <header className="print-brand-header"><div><h1>{organization.name}</h1><p>{location.name}</p></div></header>
      <section className="print-title-block"><p className="print-document-kind">{t("title")}</p><h2>{document.number}</h2>
        <p>{t("issuedAt")}: {formatOrganizationDateTime(document.issuedAt, locale, organization.timezone)}</p>
        {albaran.document_status === "cancelled" ? <p className="font-bold">{t("cancelled")}</p> : null}
      </section>
      <dl className="print-key-values">
        <div><dt>{t("customer")}</dt><dd>{customer.name}</dd></div>
        <div><dt>{t("property")}</dt><dd>{property?.name ?? "—"}</dd></div>
        <div><dt>{t("order")}</dt><dd>{order.number}</dd></div>
        <div><dt>{t("completedRecordedAt")}</dt><dd>{formatOrganizationDateTime(completion.recordedAt, locale, organization.timezone)}</dd></div>
      </dl>
      <table className="print-items-table"><thead><tr><th>{t("service")}</th><th>{t("quantity")}</th><th>{t("unit")}</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{formatQuantity(item.quantity, locale)}</td><td>{unitT(item.unitType)}</td></tr>)}</tbody>
      </table>
      <footer className="print-notes"><p>{t("recordedEvidence")}</p><p className="print-legal-boundary">{t("notFiscal")}</p></footer>
    </article>
  </div>;
}
