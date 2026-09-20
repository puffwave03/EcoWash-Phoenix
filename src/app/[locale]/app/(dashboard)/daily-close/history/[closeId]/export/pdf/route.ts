import { getTranslations } from "next-intl/server";
import { buildDailyCloseExportRows, createDailyClosePdf } from "@/features/daily-close/export";
import { getPersistedDailyCloseById } from "@/features/daily-close/server/persisted-queries";

export async function GET(_request: Request, { params }: {
  params: Promise<{ closeId: string; locale: string }>;
}) {
  const { closeId, locale } = await params;
  const [close, t] = await Promise.all([
    getPersistedDailyCloseById(locale, closeId),
    getTranslations({ locale, namespace: "common.dailyClose" }),
  ]);
  if (!close) return new Response("Not found", { status: 404 });

  const exportText = t.raw("export") as {
    accountingLabels: Record<string, string>;
    closedBy: string;
    nonFiscal: string;
    page: string;
    reportTitle: string;
    sections: Record<string, string>;
    snapshotHash: string;
    snapshotUnavailable: string;
  };
  const metrics = t.raw("metrics") as Record<string, string>;
  const definitive = t.raw("definitive") as {
    completedDeliveries: string;
    completedPickups: string;
    labels: { closeNote: string };
    serverBlockers: Record<string, string>;
    warningLabels: Record<string, string>;
  };
  const scopeLabel = close.locationName ?? t("history.organizationWide");
  const rows = buildDailyCloseExportRows(close, scopeLabel);
  const labels: Record<string, string> = {
    report_type: exportText.nonFiscal,
    business_date: t("history.businessDate"),
    scope: t("history.scope"),
    closed_at: t("history.closedAt"),
    closed_by: exportText.closedBy,
    close_note: definitive.labels.closeNote,
    snapshot_hash: exportText.snapshotHash,
    snapshot_unavailable: exportText.snapshotUnavailable,
    orders_created: metrics.ordersCreated,
    production_completed: metrics.productionCompleted,
    final_fulfillment_completed: metrics.finalFulfillmentCompleted,
    orderCount: exportText.accountingLabels.orderCount,
    salesGross: exportText.accountingLabels.salesGross,
    salesNet: exportText.accountingLabels.salesNet,
    discountTotal: exportText.accountingLabels.discountTotal,
    outstanding: metrics.outstanding,
    outstandingOrderCount: metrics.outstandingOrders,
    confirmedPaymentCount: metrics.confirmedPayments,
    collectedGross: metrics.collectedGross,
    refunds: metrics.refunds,
    collectedNet: metrics.collectedNet,
    cashCollected: metrics.cash,
    cardCollected: metrics.card,
    bankTransferCollected: metrics.bankTransfer,
    otherCollected: metrics.other,
    onlineCollected: metrics.online,
    sessionCount: exportText.accountingLabels.sessionCount,
    openSessions: metrics.openSessions,
    closedSessions: metrics.closedSessions,
    openingCash: exportText.accountingLabels.openingCash,
    expectedCash: metrics.expectedCash,
    countedCash: metrics.countedCash,
    variance: metrics.variance,
    cashPaymentsWithoutValidSession: metrics.cashWithoutSession,
    completedPickupIds: definitive.completedPickups,
    completedDeliveryIds: definitive.completedDeliveries,
    pickupsDueOpen: metrics.pickupsDue,
    deliveriesDueOpen: metrics.deliveriesDue,
    inProgress: metrics.inProgress,
    overduePickups: metrics.overduePickups,
    overdueDeliveries: metrics.overdueDeliveries,
    ...definitive.warningLabels,
    ...definitive.serverBlockers,
  };
  const pdf = createDailyClosePdf(rows, locale, {
    labels,
    nonFiscal: exportText.nonFiscal,
    page: exportText.page,
    reportTitle: exportText.reportTitle,
    sections: exportText.sections,
    snapshotUnavailable: exportText.snapshotUnavailable,
  });
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="daily-close-${close.businessDate}-${close.id}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
