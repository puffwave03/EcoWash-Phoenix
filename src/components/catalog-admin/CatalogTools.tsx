"use client";

import { useActionState } from "react";
import type { CatalogAdminActionState } from "@/features/catalog-admin/types";
import type { CatalogOrderMode } from "@/features/catalog-productization/types";
import type { UnifiedImportState } from "@/features/catalog-productization/unified";

type Text = {
  applyImport: string;
  cancelHelp: string;
  confirmImport: string;
  export: string;
  exportHelp: string;
  import: string;
  importError: string;
  importHelp: string;
  importSizeError: string;
  importSuccess: string;
  importMode: string;
  pricesOnly: string;
  catalogAndPrices: string;
  effectiveDate: string;
  previewPriceSummary: string;
  previewTransferSummary: string;
  previewFields: Record<string, string>;
  previewOperations: Record<string, string>;
  previewErrors: Record<string, string>;
  unitTypes: Record<string, string>;
  stalePreview: string;
  modes: Record<CatalogOrderMode, string>;
  ordering: string;
  orderingHelp: string;
  preview: string;
  previewSummary: string;
  save: string;
  saved: string;
  title: string;
};

const catalogInitial: CatalogAdminActionState = { fieldErrors: {}, formError: null, success: false };
const importInitial: UnifiedImportState = { error: null, payload: null, preview: null, success: false };

export function CatalogTools({ confirmAction, exportHref, orderMode, orderModeAction, previewAction, text }: {
  confirmAction: (state: UnifiedImportState, formData: FormData) => Promise<UnifiedImportState>;
  exportHref: string;
  orderMode: CatalogOrderMode;
  orderModeAction: (state: CatalogAdminActionState, formData: FormData) => Promise<CatalogAdminActionState>;
  previewAction: (state: UnifiedImportState, formData: FormData) => Promise<UnifiedImportState>;
  text: Text;
}) {
  const [orderState, orderAction, orderPending] = useActionState(orderModeAction, catalogInitial);
  const [previewState, runPreview, previewPending] = useActionState(previewAction, importInitial);
  const [confirmState, runConfirm, confirmPending] = useActionState(confirmAction, importInitial);
  return (
    <section aria-labelledby="catalog-tools-title" className="rounded-card border border-border bg-primary-soft/30 p-4 sm:p-5">
      <h2 className="text-xl font-semibold text-primary" id="catalog-tools-title">{text.title}</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <form action={orderAction} className="rounded-card border border-border bg-white p-4">
          <h3 className="font-semibold text-primary">{text.ordering}</h3><p className="mt-1 text-sm text-muted">{text.orderingHelp}</p>
          <select className="mt-3 min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue={orderMode} name="orderMode">{Object.entries(text.modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button className="mt-3 min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={orderPending} type="submit">{text.save}</button>
          {orderState.success ? <p className="mt-2 text-sm font-semibold text-emerald-700" role="status">{text.saved}</p> : orderState.formError || Object.keys(orderState.fieldErrors).length ? <p className="mt-2 text-sm text-red-700" role="alert">{text.importError}</p> : null}
        </form>
        <div className="rounded-card border border-border bg-white p-4">
          <h3 className="font-semibold text-primary">{text.export}</h3><p className="mt-1 text-sm text-muted">{text.exportHelp}</p>
          <a className="mt-3 inline-flex min-h-11 items-center rounded-control border border-primary px-4 text-sm font-semibold text-primary" href={exportHref}>{text.export}</a>
        </div>
        <form action={runPreview} className="rounded-card border border-border bg-white p-4">
          <h3 className="font-semibold text-primary">{text.import}</h3><p className="mt-1 text-sm text-muted">{text.importHelp}</p>
          <label className="mt-3 block text-sm font-medium text-primary">{text.importMode}
            <select className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue="prices_only" name="mode">
              <option value="prices_only">{text.pricesOnly}</option>
              <option value="catalog_and_prices">{text.catalogAndPrices}</option>
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-primary">{text.effectiveDate}
            <input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3" name="effectiveDate" required type="date" />
          </label>
          <input accept=".csv,text/csv" className="mt-3 block w-full text-sm" name="catalogFile" required type="file" />
          <button className="mt-3 min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={previewPending} type="submit">{text.preview}</button>
        </form>
      </div>
      {previewState.error ? <p className="mt-4 text-sm text-red-700" role="alert">{previewState.error === "rows" ? text.importSizeError : text.importError}</p> : null}
      {previewState.preview ? <div className="mt-4 rounded-card border border-border bg-white p-4">
        <h3 className="font-semibold text-primary">{text.preview}</h3>
        <p className="mt-1 text-sm text-muted">{text.previewSummary.replace("{unchanged}", String(previewState.preview.unchanged)).replace("{updates}", String(previewState.preview.catalogUpdates)).replace("{creates}", String(previewState.preview.catalogCreates)).replace("{errors}", String(previewState.preview.errors)).replace("{archives}", "0")}</p>
        <p className="mt-1 text-sm text-muted">{text.previewPriceSummary.replace("{creates}", String(previewState.preview.priceCreates)).replace("{closures}", String(previewState.preview.priceClosures))}</p>
        <p className="mt-1 text-sm text-muted">{text.previewTransferSummary.replace("{imported}", String(previewState.preview.imported)).replace("{skipped}", String(previewState.preview.skipped)).replace("{rejected}", String(previewState.preview.errors))}</p>
        <div className="mt-3 max-h-96 overflow-auto"><table className="w-full min-w-[72rem] text-left text-sm">
          <thead><tr className="border-b border-border">{["row", "code", "name", "unitType", "previousPrice", "newPrice", "previousIsFrom", "newIsFrom", "effectiveDate", "catalog", "price", "status"].map((field) => <th className="px-2 py-2" key={field} scope="col">{text.previewFields[field]}</th>)}</tr></thead>
          <tbody>{previewState.preview.items.map((item) => <tr className="border-t border-border" key={`${item.row}-${item.code}`}>
            <td className="px-2 py-2">{item.row}</td><td className="px-2 py-2 font-semibold">{item.code || "—"}</td>
            <td className="px-2 py-2">{item.name || "—"}</td><td className="px-2 py-2">{text.unitTypes[item.unitType] ?? item.unitType}</td>
            <td className="px-2 py-2">{item.previousAmount ?? "—"}</td><td className="px-2 py-2">{item.newAmount ?? "—"}</td>
            <td className="px-2 py-2">{item.previousIsFrom === null ? "—" : item.previousIsFrom ? text.previewOperations.yes : text.previewOperations.no}</td>
            <td className="px-2 py-2">{item.newIsFrom === null ? "—" : item.newIsFrom ? text.previewOperations.yes : text.previewOperations.no}</td>
            <td className="px-2 py-2">{item.effectiveDate}</td>
            <td className="px-2 py-2">{text.previewOperations[item.catalog]}</td><td className="px-2 py-2">{text.previewOperations[item.price]}</td>
            <td className="px-2 py-2">{item.errors.length ? item.errors.map((error) => text.previewErrors[error] ?? error).join("; ") : item.skipped ? `${text.previewOperations.skipped}: ${text.previewOperations[item.skipped] ?? item.skipped}` : text.previewOperations.imported}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="mt-3 text-xs text-muted">{text.cancelHelp}</p>
        {previewState.payload ? <form action={runConfirm} className="mt-3"><input name="payload" type="hidden" value={previewState.payload} /><button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={confirmPending} type="submit">{text.confirmImport}</button></form> : null}
      </div> : null}
      {confirmState.success ? <p className="mt-4 text-sm font-semibold text-emerald-700" role="status">{text.importSuccess}</p> : confirmState.error ? <p className="mt-4 text-sm text-red-700" role="alert">{confirmState.error === "stale_preview" ? text.stalePreview : confirmState.error === "rows" ? text.importSizeError : text.importError}</p> : null}
    </section>
  );
}
