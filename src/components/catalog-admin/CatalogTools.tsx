"use client";

import { useActionState } from "react";
import type { CatalogAdminActionState } from "@/features/catalog-admin/types";
import type { CatalogImportState, CatalogOrderMode } from "@/features/catalog-productization/types";

type Text = {
  applyImport: string;
  cancelHelp: string;
  confirmImport: string;
  export: string;
  exportHelp: string;
  import: string;
  importError: string;
  importHelp: string;
  importSuccess: string;
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
const importInitial: CatalogImportState = { error: null, payload: null, preview: null, success: false };

export function CatalogTools({ confirmAction, exportHref, orderMode, orderModeAction, previewAction, text }: {
  confirmAction: (state: CatalogImportState, formData: FormData) => Promise<CatalogImportState>;
  exportHref: string;
  orderMode: CatalogOrderMode;
  orderModeAction: (state: CatalogAdminActionState, formData: FormData) => Promise<CatalogAdminActionState>;
  previewAction: (state: CatalogImportState, formData: FormData) => Promise<CatalogImportState>;
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
          <input accept=".csv,text/csv" className="mt-3 block w-full text-sm" name="catalogFile" required type="file" />
          <button className="mt-3 min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={previewPending} type="submit">{text.preview}</button>
        </form>
      </div>
      {previewState.error ? <p className="mt-4 text-sm text-red-700" role="alert">{text.importError}</p> : null}
      {previewState.preview ? <div className="mt-4 rounded-card border border-border bg-white p-4">
        <h3 className="font-semibold text-primary">{text.preview}</h3>
        <p className="mt-1 text-sm text-muted">{text.previewSummary.replace("{unchanged}", String(previewState.preview.unchanged)).replace("{updates}", String(previewState.preview.updates)).replace("{creates}", String(previewState.preview.creates)).replace("{errors}", String(previewState.preview.errors)).replace("{archives}", String(previewState.preview.archives))}</p>
        <div className="mt-3 max-h-64 overflow-auto"><table className="w-full min-w-[34rem] text-left text-sm"><tbody>{previewState.preview.items.filter((item) => item.action !== "unchanged").map((item) => <tr className="border-t border-border" key={`${item.row}-${item.code}`}><td className="py-2 pr-3">{item.row}</td><td className="py-2 pr-3 font-semibold">{item.code || "—"}</td><td className="py-2 pr-3">{item.name}</td><td className="py-2">{item.action}{item.errors.length ? ` · ${item.errors.join(", ")}` : ""}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-muted">{text.cancelHelp}</p>
        {previewState.payload ? <form action={runConfirm} className="mt-3"><input name="payload" type="hidden" value={previewState.payload} /><button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={confirmPending} type="submit">{text.confirmImport}</button></form> : null}
      </div> : null}
      {confirmState.success ? <p className="mt-4 text-sm font-semibold text-emerald-700" role="status">{text.importSuccess}</p> : confirmState.error ? <p className="mt-4 text-sm text-red-700" role="alert">{text.importError}</p> : null}
    </section>
  );
}
