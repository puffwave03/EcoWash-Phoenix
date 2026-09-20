import type { PersistedDailyCloseWithScope } from "@/features/daily-close/persisted-types";

export type DailyCloseExportRow = {
  currency: string;
  key: string;
  section: "accounting" | "blockers" | "logistics" | "metadata" | "operational" | "pos" | "warnings";
  value: number | string;
};

export type DailyClosePdfText = {
  labels: Record<string, string>;
  nonFiscal: string;
  page: string;
  reportTitle: string;
  sections: Record<DailyCloseExportRow["section"], string>;
  snapshotUnavailable: string;
};

const MONETARY_KEYS = new Set([
  "salesGross", "salesNet", "discountTotal", "outstanding", "collectedGross",
  "refunds", "collectedNet", "cashCollected", "cardCollected",
  "bankTransferCollected", "otherCollected", "onlineCollected", "openingCash",
  "expectedCash", "countedCash", "variance",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rowsFromRecord(
  section: DailyCloseExportRow["section"],
  value: unknown,
  keys: string[],
  currency = "",
) {
  const row = record(value);
  if (!row) return [];
  return keys.map<DailyCloseExportRow>((key) => ({
    currency,
    key,
    section,
    value: number(row[key]),
  }));
}

function issueRows(section: "blockers" | "warnings", value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap<DailyCloseExportRow>((item) => {
    const row = record(item);
    return typeof row?.code === "string"
      ? [{ currency: "", key: row.code, section, value: number(row.count) }]
      : [];
  }).sort((a, b) => a.key.localeCompare(b.key));
}

export function buildDailyCloseExportRows(
  close: PersistedDailyCloseWithScope,
  scopeLabel: string,
): DailyCloseExportRow[] {
  const snapshot = record(close.snapshot);
  const orders = record(snapshot?.orders);
  const finalFulfillment = record(snapshot?.finalFulfillment);
  const pos = record(snapshot?.pos);
  const logistics = record(snapshot?.logistics);
  const rows: DailyCloseExportRow[] = [
    { currency: "", key: "report_type", section: "metadata", value: "operational_internal_non_fiscal" },
    { currency: "", key: "business_date", section: "metadata", value: close.businessDate },
    { currency: "", key: "scope", section: "metadata", value: scopeLabel },
    { currency: "", key: "closed_at", section: "metadata", value: close.closedAt },
    { currency: "", key: "closed_by", section: "metadata", value: close.closedBy },
    { currency: "", key: "close_note", section: "metadata", value: close.closeNote ?? "" },
    { currency: "", key: "snapshot_hash", section: "metadata", value: close.snapshotHash },
  ];

  if (!snapshot || !orders || !finalFulfillment || !pos || !logistics) {
    rows.push({ currency: "", key: "snapshot_unavailable", section: "operational", value: 1 });
    return rows;
  }

  rows.push(
    { currency: "", key: "orders_created", section: "operational", value: number(orders.created) },
    { currency: "", key: "production_completed", section: "operational", value: number(orders.productionCompleted) },
    { currency: "", key: "final_fulfillment_completed", section: "operational", value: number(finalFulfillment.completedOrderCount) },
  );

  const accountingKeys = [
    "orderCount", "salesGross", "salesNet", "discountTotal", "outstanding",
    "outstandingOrderCount", "confirmedPaymentCount", "collectedGross", "refunds",
    "collectedNet", "cashCollected", "cardCollected", "bankTransferCollected",
    "otherCollected", "onlineCollected",
  ];
  const accounting = Array.isArray(snapshot.payments) ? snapshot.payments : [];
  for (const item of accounting.toSorted((a, b) => String(record(a)?.currency ?? "").localeCompare(String(record(b)?.currency ?? "")))) {
    const payment = record(item);
    if (!payment || typeof payment.currency !== "string") continue;
    for (const key of accountingKeys) {
      rows.push({ currency: payment.currency, key, section: "accounting", value: number(payment[key]) });
    }
  }

  rows.push(...rowsFromRecord("pos", snapshot.pos, [
    "sessionCount", "openSessions", "closedSessions", "openingCash",
    "expectedCash", "countedCash", "variance", "cashPaymentsWithoutValidSession",
  ], typeof pos.currency === "string" ? pos.currency : ""));
  rows.push(...rowsFromRecord("logistics", snapshot.logistics, [
    "completedPickupIds", "completedDeliveryIds", "pickupsDueOpen",
    "deliveriesDueOpen", "inProgress", "overduePickups", "overdueDeliveries",
  ]).map((row) => {
    if (row.key === "completedPickupIds") return { ...row, value: Array.isArray(logistics.completedPickupIds) ? logistics.completedPickupIds.length : 0 };
    if (row.key === "completedDeliveryIds") return { ...row, value: Array.isArray(logistics.completedDeliveryIds) ? logistics.completedDeliveryIds.length : 0 };
    return row;
  }));
  rows.push(...issueRows("warnings", snapshot.warnings));
  rows.push(...issueRows("blockers", snapshot.blockers));
  return rows;
}

function csvCell(value: number | string) {
  let content = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(content)) content = `'${content}`;
  return `"${content.replaceAll('"', '""')}"`;
}

export function serializeDailyCloseCsv(rows: DailyCloseExportRow[]) {
  return [
    ["section", "key", "currency", "value"].map(csvCell).join(","),
    ...rows.map((row) => [row.section, row.key, row.currency, row.value].map(csvCell).join(",")),
  ].join("\r\n");
}

const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
};

function pdfString(value: string) {
  const normalized = value.normalize("NFC");
  let result = "";
  for (const character of normalized) {
    const code = WIN_ANSI[character] ?? character.codePointAt(0) ?? 63;
    const byte = code <= 255 ? code : 63;
    const encoded = String.fromCharCode(byte);
    result += encoded === "\\" || encoded === "(" || encoded === ")"
      ? `\\${encoded}`
      : encoded === "\n" || encoded === "\r" ? " " : encoded;
  }
  return result;
}

function wrap(value: string, maxCharacters: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters) line = candidate;
    else {
      if (line) lines.push(line);
      line = word.length <= maxCharacters ? word : `${word.slice(0, maxCharacters - 1)}…`;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function displayValue(row: DailyCloseExportRow, locale: string) {
  if (typeof row.value !== "number") return row.value || "-";
  return row.currency && MONETARY_KEYS.has(row.key)
    ? new Intl.NumberFormat(locale, { currency: row.currency, style: "currency" }).format(row.value)
    : new Intl.NumberFormat(locale).format(row.value);
}

export function createDailyClosePdf(
  rows: DailyCloseExportRow[],
  locale: string,
  text: DailyClosePdfText,
) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const bottom = 54;
  const pages: string[][] = [[]];
  let page = pages[0];
  let y = pageHeight - margin;

  const addLine = (value: string, size = 10, bold = false, gapBefore = 0) => {
    const lineHeight = size + 5;
    for (const line of wrap(value, Math.max(28, Math.floor((pageWidth - margin * 2) / (size * 0.53))))) {
      if (y - gapBefore - lineHeight < bottom) {
        page = [];
        pages.push(page);
        y = pageHeight - margin;
      }
      y -= gapBefore;
      page.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${margin} ${y} Td (${pdfString(line)}) Tj ET`);
      y -= lineHeight;
      gapBefore = 0;
    }
  };

  addLine(text.reportTitle, 18, true);
  addLine(text.nonFiscal, 10, true, 3);
  let currentSection = "";
  for (const row of rows) {
    if (row.section !== currentSection) {
      currentSection = row.section;
      addLine(text.sections[row.section], 13, true, 10);
    }
    const label = text.labels[row.key] ?? row.key.replaceAll("_", " ");
    const currency = row.currency && MONETARY_KEYS.has(row.key)
      ? ` (${row.currency})`
      : "";
    addLine(`${label}${currency}: ${displayValue(row, locale)}`);
  }

  const objects: string[] = ["", "", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const pageIds: number[] = [];
  pages.forEach((commands, index) => {
    commands.push(`BT /F1 8 Tf ${pageWidth - margin - 50} 28 Td (${pdfString(`${text.page} ${index + 1}/${pages.length}`)}) Tj ET`);
    const stream = commands.join("\n");
    const contentId = objects.length;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = objects.length;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Uint8Array.from(pdf, (character) => character.charCodeAt(0));
}
