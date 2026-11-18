// Explicit local-only synthetic preview. No Next route, environment files,
// Supabase client, business data, fiscal counters or server actions are loaded.
// Run: node scripts/preview-billing-simplified-ticket.mjs
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
export function loadPreviewModule(relativePath) {
  const path = resolve(root, relativePath);
  if (modules.has(path)) return modules.get(path);
  const compiledModule = { exports: {} };
  const localRequire = (name) => {
    if (["react", "react/jsx-runtime", "next/image"].includes(name)) return require(name);
    const candidate = name.startsWith("@/") ? resolve(root, "src", name.slice(2))
      : name.startsWith("./") ? resolve(dirname(path), name) : null;
    if (!candidate) throw Error(`Preview import denied: ${name}`);
    const file = [".ts", ".tsx"].map((extension) => candidate + extension).find(existsSync);
    if (!file) throw Error(`Missing preview module: ${name}`);
    return loadPreviewModule(file);
  };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: localRequire }, { filename: path });
  modules.set(path, compiledModule.exports);
  return compiledModule.exports;
}

export function previewProps(scenario = "walkin", locale = "es") {
  const { billingSimplifiedDraftDocument } = loadPreviewModule("src/features/billing/simplified-document.ts");
  const detail = {
    invoice: {
      id: "synthetic-draft", fiscalDocumentType: "simplificada", documentStatus: "draft", invoiceNumber: null,
      issuedAt: null, issueDate: "2026-11-18", series: "DEMO-S", currency: "EUR", pricesIncludeTax: true,
      issuerLegalName: "Lavandería de ejemplo S.L.", issuerTaxId: "NIF DE EJEMPLO", issuerAddressLine1: "Calle de Ejemplo, 10",
      issuerAddressLine2: null, issuerCity: "Localidad de ejemplo", issuerRegion: null, issuerPostalCode: "00000",
      issuerCountryCode: "ES", issuerEmail: "ejemplo@example.invalid", issuerPhone: "+34 000 000 000", issuerLogoPath: "synthetic-logo",
      customerName: null, customerTaxId: null, customerAddressLine1: null, customerAddressLine2: null,
      customerCity: null, customerPostalCode: null, customerCountryCode: null, customerEmail: null,
      orderIds: ["synthetic-order"], orderNumbers: ["DEMO-EW-001"], subtotal: 14, discountTotal: 1,
      taxableBase: 12.15, taxTotal: .85, total: 13,
    },
    items: [
      { id: "line-1", sourceOrderId: "synthetic-order", description: "Lavado y planchado · camisa", unitType: "piece", quantity: 2,
        unitPrice: 4, lineSubtotal: 8, discountAmount: 1, taxableBase: 6.54, taxRate: 7, taxAmount: .46, lineTotal: 7, displayOrder: 1 },
      { id: "line-2", sourceOrderId: "synthetic-order", description: "Lavado de ropa por peso", unitType: "weight", quantity: 1.5,
        unitPrice: 4, lineSubtotal: 6, discountAmount: 0, taxableBase: 5.61, taxRate: 7, taxAmount: .39, lineTotal: 6, displayOrder: 2 },
    ], payments: [],
  };
  if (scenario === "named") Object.assign(detail.invoice, {
    customerName: "Cliente de ejemplo", customerTaxId: "NIF CLIENTE DE EJEMPLO",
    customerAddressLine1: "Calle de Prueba, 20", customerCity: "Ciudad de ejemplo", customerPostalCode: "00000", customerCountryCode: "ES",
  });
  if (scenario === "incomplete") Object.assign(detail.invoice, { issuerTaxId: null, issuerAddressLine1: null });
  if (scenario === "long") detail.items[0].description = "Servicio de lavandería para prendas delicadas · "
    + "DescripciónLargaSinEspacios".repeat(6);
  if (scenario === "tenant-b") Object.assign(detail.invoice, {
    issuerLegalName: "Tintorería de ejemplo B", issuerLogoPath: "synthetic-tenant-b/logo.svg",
  });
  if (scenario === "no-logo") detail.invoice.issuerLogoPath = null;
  // Synthetic tenant branding only; no Phoenix logo or another tenant's asset.
  const logo = scenario === "tenant-b"
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="64" viewBox="0 0 160 64"><path d="M55 10h50l15 44H40z" fill="#333"/><text x="80" y="42" text-anchor="middle" font-family="Arial" font-size="25" fill="white">B</text></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="64" viewBox="0 0 160 64"><circle cx="80" cy="32" r="29" fill="#0f3b2e"/><text x="80" y="42" text-anchor="middle" font-family="Arial" font-size="29" fill="white">L</text></svg>';
  const exampleNote = "Texto de ejemplo para la nota del servicio.\nSegunda línea de ejemplo.";
  return {
    document: billingSimplifiedDraftDocument(detail), locale, timeZone: "Atlantic/Canary",
    presentation: {
      branding: { logoPath: detail.invoice.issuerLogoPath,
        logoUrl: detail.invoice.issuerLogoPath ? `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}` : null },
      serviceConditions: scenario === "no-note" ? null : scenario === "long-note"
        ? Array.from({ length: 8 }, (_, index) => `${index + 1}. Texto de ejemplo para comprobar el ajuste de una nota multilínea.`).join("\n")
        : exampleNote,
      isSharedWalkIn: scenario !== "named", payment: { paidAmount: 13, outstandingAmount: 0, methodLabel: "Efectivo · ejemplo" },
      pickupByOrder: { "synthetic-order": "2026-11-20T17:30:00Z" },
    },
    demonstration: { number: "EJEMPLO-DEMO-S-000001", issuedAt: "2026-11-18T12:34:00Z" },
  };
}

export function previewHtml(scenario = "walkin", locale = "es") {
  const { BillingSimplifiedTicket } = loadPreviewModule("src/components/billing/BillingSimplifiedTicket.tsx");
  const { PrintButton } = loadPreviewModule("src/components/printing/PrintButton.tsx");
  const html = renderToStaticMarkup(createElement("html", { lang: locale },
    createElement("head", null, createElement("meta", { charSet: "utf-8" }),
      createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      createElement("title", null, "Phoenix · preview local"),
      // Reuse the existing native receipt print rules; no Tailwind build or new
      // printing pipeline is needed by this isolated static preview.
      createElement("style", null, readFileSync(resolve(root, "src/styles/globals.css"), "utf8").replace('@import "tailwindcss";', "")),
      createElement("style", null, `body{margin:0;background:#eee;padding:20px;font-family:Arial,sans-serif}
        .local-preview-controls{max-width:680px;margin:0 auto 20px;line-height:1.8}
        .local-preview-controls a{margin-right:12px;color:#0f3b2e}.local-preview-controls button{padding:8px 16px;cursor:pointer}
        @media print{.local-preview-controls{display:none}body{padding:0;margin:0;background:white}}`)),
    createElement("body", null,
      createElement("nav", { className: "local-preview-controls", "aria-label": "Preview local" },
        createElement("p", null, "Preview local · ejemplos sintéticos · 80 mm"),
        ...["walkin", "named", "incomplete", "long", "tenant-b", "no-logo", "no-note", "long-note"].map((name) => createElement("a", { key: name, href: `/?case=${name}&locale=${locale}` }, name)),
        createElement("div", { id: "local-preview-print" }, createElement(PrintButton, { label: "Imprimir ejemplo" }))),
      createElement(BillingSimplifiedTicket, previewProps(scenario, locale)),
      // Static SSR does not hydrate client controls. Bind only the existing
      // browser print operation, without a history callback or business write.
      createElement("script", null, "document.querySelector('#local-preview-print button').addEventListener('click',()=>window.print())"))));
  return `<!doctype html>${html}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:4180");
    if (request.method !== "GET" || url.pathname !== "/") { response.writeHead(404).end(); return; }
    const scenario = ["walkin", "named", "incomplete", "long", "tenant-b", "no-logo", "no-note", "long-note"].includes(url.searchParams.get("case")) ? url.searchParams.get("case") : "walkin";
    const locale = ["es", "it", "en", "fr", "de"].includes(url.searchParams.get("locale")) ? url.searchParams.get("locale") : "es";
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(previewHtml(scenario, locale));
  }).listen(4180, "127.0.0.1", () => console.log("Synthetic ticket preview: http://127.0.0.1:4180"));
}
