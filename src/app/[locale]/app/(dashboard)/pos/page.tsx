import { getTranslations } from "next-intl/server";
import { PosWorkspace, type PosText } from "@/components/pos/PosWorkspace";
import { closePosSessionAction, openPosSessionAction, recordPosPaymentAction, refundPosPaymentAction } from "@/features/pos/server/actions";
import { getCurrentPosSession, getPosCurrency, getPosSessionSummary, listPosLocations, listPosOrdersDue, listPosSessionHistory, listPosSessionPayments } from "@/features/pos/server/queries";
import { requirePosAccess } from "@/features/pos/server/access";

type PosPageProps = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

export default async function PosPage({ params, searchParams }: PosPageProps) {
  const { locale } = await params;
  const { q = "" } = await searchParams;
  const access = await requirePosAccess(locale);
  const [session, orders, history, locations, currency, t] = await Promise.all([
    getCurrentPosSession(locale), listPosOrdersDue(locale, q.slice(0, 80)), listPosSessionHistory(locale), listPosLocations(locale), getPosCurrency(locale), getTranslations({ locale, namespace: "common.pos" }),
  ]);
  const [summary, payments] = session ? await Promise.all([getPosSessionSummary(locale, session.id), listPosSessionPayments(locale, session.id)]) : [null, []];
  const text: PosText = {
    actions: t.raw("actions"), close: t.raw("close"), common: t.raw("common"), errors: t.raw("errors"), history: t.raw("history"), methods: t.raw("methods"), orders: t.raw("orders"), payments: t.raw("payments"), session: t.raw("session"), statuses: t.raw("statuses"), subtitle: t("subtitle"), success: t("success"), title: t("title"),
  };
  return <PosWorkspace actions={{ close: closePosSessionAction.bind(null, locale), open: openPosSessionAction.bind(null, locale), pay: recordPosPaymentAction.bind(null, locale), refund: refundPosPaymentAction.bind(null, locale) }} canSeeHistory={access.membership.role !== "staff"} currency={currency} history={history} locale={locale} locations={locations} orders={orders} payments={payments} query={q} session={session} summary={summary} text={text} />;
}
