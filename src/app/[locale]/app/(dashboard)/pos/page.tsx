import { getTranslations } from "next-intl/server";
import { PosWorkspace, type PosText } from "@/components/pos/PosWorkspace";
import { closePosSessionAction, openPosSessionAction, recordPosPaymentAction, refundPosPaymentAction } from "@/features/pos/server/actions";
import { getCurrentPosSession, getPosCurrency, getPosSessionSummary, listPosLocations, listPosOrdersDue, listPosSessionHistory, listPosSessionPayments } from "@/features/pos/server/queries";
import { requirePosAccess } from "@/features/pos/server/access";
import { decodePosPaymentCursor, decodePosSessionCursor, posHistoryHref, type PosNavigation } from "@/features/pos/pagination";

type PosPageProps = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; paymentCursor?: string; historyCursor?: string }> };

export default async function PosPage({ params, searchParams }: PosPageProps) {
  const { locale } = await params;
  const { q = "", paymentCursor: paymentCursorInput, historyCursor: historyCursorInput } = await searchParams;
  const access = await requirePosAccess(locale);
  const canSeeHistory = access.membership.role !== "staff";
  const historyCursor = canSeeHistory ? decodePosSessionCursor(historyCursorInput) : null;
  const validHistoryCursor = historyCursor ? historyCursorInput ?? null : null;
  const [session, orders, historyPage, locations, currency, t] = await Promise.all([
    getCurrentPosSession(locale), listPosOrdersDue(locale, q.slice(0, 80)), listPosSessionHistory(locale, historyCursor), listPosLocations(locale), getPosCurrency(locale), getTranslations({ locale, namespace: "common.pos" }),
  ]);
  const paymentCursor = session ? decodePosPaymentCursor(paymentCursorInput, session.id) : null;
  const validPaymentCursor = paymentCursor ? paymentCursorInput ?? null : null;
  const [summary, paymentPage] = session ? await Promise.all([getPosSessionSummary(locale, session.id), listPosSessionPayments(locale, session.id, paymentCursor)]) : [null, { items: [], pagination: { newerCursor: null, olderCursor: null } }];
  const paymentNavigation: PosNavigation = {
    currentCursor: validPaymentCursor,
    latestHref: validPaymentCursor ? posHistoryHref(q, null, validHistoryCursor) : null,
    newerHref: paymentPage.pagination.newerCursor ? posHistoryHref(q, paymentPage.pagination.newerCursor, validHistoryCursor) : null,
    olderHref: paymentPage.pagination.olderCursor ? posHistoryHref(q, paymentPage.pagination.olderCursor, validHistoryCursor) : null,
  };
  const historyNavigation: PosNavigation = {
    currentCursor: validHistoryCursor,
    latestHref: validHistoryCursor ? posHistoryHref(q, validPaymentCursor, null) : null,
    newerHref: historyPage.pagination.newerCursor ? posHistoryHref(q, validPaymentCursor, historyPage.pagination.newerCursor) : null,
    olderHref: historyPage.pagination.olderCursor ? posHistoryHref(q, validPaymentCursor, historyPage.pagination.olderCursor) : null,
  };
  const text: PosText = {
    actions: t.raw("actions"), close: t.raw("close"), common: t.raw("common"), errors: t.raw("errors"), history: t.raw("history"), methods: t.raw("methods"), orders: t.raw("orders"), pagination: t.raw("pagination"), payments: t.raw("payments"), session: t.raw("session"), statuses: t.raw("statuses"), subtitle: t("subtitle"), success: t("success"), title: t("title"),
  };
  return <PosWorkspace actions={{ close: closePosSessionAction.bind(null, locale), open: openPosSessionAction.bind(null, locale), pay: recordPosPaymentAction.bind(null, locale), refund: refundPosPaymentAction.bind(null, locale) }} canSeeHistory={canSeeHistory} currency={currency} history={historyPage.items} historyNavigation={historyNavigation} locale={locale} locations={locations} orders={orders} payments={paymentPage.items} paymentNavigation={paymentNavigation} query={q} session={session} summary={summary} text={text} />;
}
