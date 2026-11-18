import Image from "next/image";
import type { BillingSimplifiedDraftDocument } from "@/features/billing/simplified-document";
import type { OrganizationBrandingSettings } from "@/features/branding/types";
import { formatTaxRate } from "@/features/billing/tax-rate";
import { formatCurrency, formatQuantity } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";
import { simplifiedTicketCopy } from "./simplified-ticket-copy";

export type BillingSimplifiedTicketProps = {
  document: BillingSimplifiedDraftDocument;
  locale: string;
  timeZone: string;
  preview?: boolean;
  // Resolved from the existing issuer logo path, as for REC. Operational data
  // are supplied separately; none of them are written into the fiscal snapshot.
  presentation?: {
    branding?: Pick<OrganizationBrandingSettings, "logoPath" | "logoUrl">;
    // Optional current service conditions, not an immutable fiscal field.
    serviceConditions?: string | null;
    isSharedWalkIn?: boolean;
    payment?: { paidAmount: number; outstandingAmount: number; methodLabel?: string };
    pickupByOrder?: Readonly<Record<string, string | null>>;
  };
  // Explicit examples for an isolated preview, never a generated fiscal number.
  demonstration?: { number: string; issuedAt: string };
};

const styles = `
.billing-simplified-ticket { width:min(80mm,100%); margin-inline:auto; color:#111; font:12px/1.4 Arial,sans-serif; }
.billing-simplified-ticket, .billing-simplified-ticket * { box-sizing:border-box; }
.billing-simplified-ticket .simplified-state { padding:3mm; margin-bottom:3mm; border:1px solid #444; font-size:11px; overflow-wrap:anywhere; }
.billing-simplified-ticket .simplified-state p { margin:1mm 0 0; }
.billing-simplified-ticket .simplified-state ul { margin:1mm 0 0; padding-left:4mm; }
.billing-simplified-ticket .simplified-paper { width:100%; padding:0; }
.billing-simplified-ticket .simplified-fiscal, .billing-simplified-ticket .simplified-operational { padding:3mm; margin:0; overflow-wrap:anywhere; }
.billing-simplified-ticket .simplified-fiscal { width:100%; }
.billing-simplified-ticket .print-brand-header { display:block; padding-bottom:2mm; text-align:center; border-bottom:1px solid #111; }
.billing-simplified-ticket .print-brand-logo { width:auto; height:auto; max-height:14mm; max-width:42mm; margin:0 auto 1mm; display:block; object-fit:contain; }
.billing-simplified-ticket h1 { margin:0 0 1mm; font-size:15px; line-height:1.25; }
.billing-simplified-ticket h2 { margin:0 0 2mm; font-size:13px; }
.billing-simplified-ticket p { margin:0.75mm 0; }
.billing-simplified-ticket .simplified-title { padding:2mm 0; text-align:center; }
.billing-simplified-ticket .simplified-title strong { display:block; font-size:14px; }
.billing-simplified-ticket .simplified-recipient { margin-bottom:3mm; padding-bottom:2mm; border-bottom:1px dashed #555; }
.billing-simplified-ticket table { width:100%; border-collapse:collapse; table-layout:fixed; }
.billing-simplified-ticket .simplified-service { width:100%; font-weight:bold; text-align:left; overflow-wrap:anywhere; }
.billing-simplified-ticket th { font-size:10px; font-weight:normal; padding:1mm 0; border-block:1px solid #555; text-align:right; }
.billing-simplified-ticket td { padding:1.5mm 0 1mm; vertical-align:top; text-align:right; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.billing-simplified-ticket td:first-child, .billing-simplified-ticket th:first-child { text-align:left; }
.billing-simplified-ticket .simplified-values td { padding-top:0; padding-bottom:2mm; border-bottom:1px dotted #aaa; }
.billing-simplified-ticket tbody { break-inside:avoid; }
.billing-simplified-ticket dl { margin:3mm 0 0; }
.billing-simplified-ticket dl > div { display:flex; justify-content:space-between; gap:3mm; padding:0.6mm 0; }
.billing-simplified-ticket dd { margin:0; font-weight:bold; text-align:right; font-variant-numeric:tabular-nums; }
.billing-simplified-ticket .simplified-total { margin-top:2mm; padding:2mm 0; border-block:2px solid #111; font-size:17px; font-weight:bold; }
.billing-simplified-ticket .simplified-included { font-size:10px; text-align:center; }
.billing-simplified-ticket .simplified-operational { border-top:1px dashed #555; font-size:11px; }
.billing-simplified-ticket .simplified-operational h2 { font-size:11px; }
.billing-simplified-ticket .simplified-operational dl { margin:0; }
.billing-simplified-ticket .simplified-terms { margin:0; padding:2mm 3mm; border-top:1px dashed #555; text-align:left; font-size:10px; line-height:1.4; overflow-wrap:anywhere; }
.billing-simplified-ticket .simplified-terms p { margin:0; white-space:pre-wrap; orphans:3; widows:3; }
@page billing-simplified-ticket { size:80mm 297mm; margin:3mm; }
@media print {
  body:has(.billing-simplified-ticket) { page:billing-simplified-ticket; }
  .order-print-document.billing-simplified-ticket { page:billing-simplified-ticket; width:100%; position:static; }
  .billing-simplified-ticket .simplified-state { break-inside:avoid; }
  .billing-simplified-ticket .simplified-fiscal, .billing-simplified-ticket .simplified-operational { padding:2mm 1mm; border-inline:0; box-shadow:none; }
  .billing-simplified-ticket .simplified-terms { padding:2mm 1mm; }
  .billing-simplified-ticket thead { display:table-header-group; }
  .billing-simplified-ticket .simplified-totals { break-inside:avoid; }
}
`;

const present = (value: string | null | undefined) => Boolean(value?.trim());
const validDate = (value: string | null | undefined) => Boolean(value && Number.isFinite(Date.parse(value)));

export function BillingSimplifiedTicket({ document: snapshot, locale, timeZone, presentation = {}, demonstration, preview = false }: BillingSimplifiedTicketProps) {
  const copy = simplifiedTicketCopy[locale.split("-")[0] as keyof typeof simplifiedTicketCopy] ?? simplifiedTicketCopy.es;
  const { document, issuer, recipient, items, tax, totals, orders } = snapshot;
  // The caller resolves this exact persisted issuer path through the existing
  // branding storage helper, as for REC; unrelated tenant branding is ignored.
  const logoUrl = present(issuer.logoPath) && presentation.branding?.logoPath === issuer.logoPath
    ? presentation.branding.logoUrl : null;
  const serviceConditions = presentation.serviceConditions?.trim() ? presentation.serviceConditions : null;
  const missing: string[] = [];
  for (const [value, label] of [
    [issuer.legalName, copy.issuer], [issuer.taxId, copy.taxId], [issuer.addressLine1, copy.address],
    [issuer.city, copy.city], [issuer.postalCode, copy.postalCode], [issuer.countryCode, copy.country],
    [document.series, copy.series],
  ] as const) if (!present(value)) missing.push(label);
  if (!preview && !present(demonstration?.number)) missing.push(copy.number);
  if (!preview && !validDate(demonstration?.issuedAt)) missing.push(copy.date);
  let zoneValid = true;
  try { new Intl.DateTimeFormat(locale, { timeZone }); } catch { zoneValid = false; missing.push(copy.timezone); }
  const currencyValid = /^[A-Z]{3}$/.test(totals.currency ?? "");
  const money = (amount: number) => currencyValid && Number.isFinite(amount) ? formatCurrency(amount, totals.currency, locale) : "—";
  const date = (value?: string | null) => zoneValid && validDate(value)
    ? formatOrganizationDateTime(value!, locale, timeZone) : "—";
  const sourceValid = snapshot.fiscalUseAllowed === false && document.fiscalDocumentType === "simplificada"
    && document.status === "draft" && document.number === null && document.issuedAt === null;
  if (!sourceValid) missing.push(copy.source);
  if (!currencyValid || !items.length || !Number.isFinite(tax.rate) || !tax.pricesIncludeTax
    || ![totals.subtotal, totals.discount, totals.total, tax.taxableBase, tax.amount].every(Number.isFinite)
    || items.some((item) => !present(item.description)
      || ![item.quantity, item.unitPrice, item.discountAmount, item.lineTotal].every(Number.isFinite))) missing.push(copy.lines);
  if (recipient === null && presentation.isSharedWalkIn !== true) missing.push(copy.recipientKind);
  if (recipient !== null && (!present(recipient.name) || presentation.isSharedWalkIn === true)) missing.push(copy.recipient);

  return <div className="order-print-document order-print-receipt order-print-receipt-80mm billing-simplified-ticket" lang={locale} data-fiscal-issued="false">
    <style>{styles}</style>
    <aside className="simplified-state" role={missing.length ? "alert" : "status"}>
      <strong>{preview ? copy.preview : demonstration ? copy.demo : copy.draft}</strong>
      {missing.length ? <><p>{copy.incomplete}</p><ul>{missing.map((field) => <li key={field}>{field}</li>)}</ul></> : null}
    </aside>
    {sourceValid ? <div className="print-sheet print-receipt-sheet print-receipt-sheet-80mm simplified-paper">
      <article className="simplified-fiscal" aria-label={preview ? copy.preview : copy.title}>
        <header className="print-brand-header">
          {logoUrl ? <Image className="print-brand-logo" src={logoUrl} alt={issuer.legalName ?? copy.issuer} width={160} height={64} unoptimized /> : null}
          <h1>{issuer.legalName || "—"}</h1>
          <p>{copy.taxId}: {issuer.taxId || "—"}</p>
          <p>{[issuer.addressLine1, issuer.addressLine2].filter(Boolean).join(", ") || "—"}</p>
          <p>{[issuer.postalCode, issuer.city, issuer.region, issuer.countryCode].filter(Boolean).join(" ")}</p>
          {[issuer.phone, issuer.email].filter(Boolean).map((contact) => <p key={contact}>{contact}</p>)}
        </header>
        <section className="simplified-title">
          <h2>{preview ? copy.preview : copy.title}</h2>
          <strong>{!preview && demonstration?.number ? demonstration.number : "—"}</strong>
          <p>{copy.series}: {document.series || "—"}</p>
          <p>{copy.date}: {date(preview ? null : demonstration?.issuedAt)}</p>
        </section>
        <section className="simplified-recipient" aria-label={copy.recipient}>
          {recipient ? <><strong>{recipient.name || "—"}</strong>
            {recipient.taxId ? <p>{copy.taxId}: {recipient.taxId}</p> : null}
            {[recipient.addressLine1, recipient.addressLine2,
              [recipient.postalCode, recipient.city, recipient.countryCode].filter(Boolean).join(" "), recipient.email]
              .filter(Boolean).map((line) => <p key={line}>{line}</p>)}</>
            : presentation.isSharedWalkIn === true ? <strong>{copy.unidentified}</strong> : <p>{copy.recipient}: —</p>}
        </section>
        <table aria-label={copy.lines}>
          <thead><tr><th scope="col">{copy.quantity}</th><th scope="col">{copy.unitPrice}</th><th scope="col">{copy.discount}</th><th scope="col">{copy.amount}</th></tr></thead>
          {items.map((item) => <tbody key={item.id}>
            <tr><td colSpan={4} className="simplified-service">{item.description}</td></tr>
            <tr className="simplified-values"><td>{formatQuantity(item.quantity, locale)} {copy[item.unitType] ?? item.unitType}</td><td>{money(item.unitPrice)}</td><td>{money(item.discountAmount)}</td><td>{money(item.lineTotal)}</td></tr>
          </tbody>)}
        </table>
        <dl className="simplified-totals">
          <div><dt>{copy.subtotal}</dt><dd>{money(totals.subtotal)}</dd></div>
          <div><dt>{copy.discount}</dt><dd>{money(totals.discount)}</dd></div>
          <div><dt>{copy.base}</dt><dd>{money(tax.taxableBase)}</dd></div>
          <div><dt>IGIC ({Number.isFinite(tax.rate) ? formatTaxRate(tax.rate, locale) : "—"}%)</dt><dd>{money(tax.amount)}</dd></div>
          <div className="simplified-total"><dt>{copy.total}</dt><dd>{money(totals.total)}</dd></div>
        </dl>
        <p className="simplified-included">{copy.included}</p>
      </article>
      <section className="simplified-operational" aria-label={copy.operational}>
        <h2>{copy.operational}</h2>
        <dl>
          <div><dt>{copy.paid}</dt><dd>{presentation.payment ? money(presentation.payment.paidAmount) : copy.unavailable}</dd></div>
          <div><dt>{copy.outstanding}</dt><dd>{presentation.payment ? money(presentation.payment.outstandingAmount) : copy.unavailable}</dd></div>
          {presentation.payment?.methodLabel ? <div><dt>{copy.method}</dt><dd>{presentation.payment.methodLabel}</dd></div> : null}
          {orders.map((order) => <div key={order.id}><dt>{copy.order}</dt><dd>{order.number}
            {presentation.pickupByOrder?.[order.id] ? <p>{copy.pickup}: {date(presentation.pickupByOrder[order.id])}</p> : null}</dd></div>)}
        </dl>
      </section>
      {serviceConditions ? <footer className="simplified-terms"><p>{serviceConditions}</p></footer> : null}
    </div> : null}
  </div>;
}
