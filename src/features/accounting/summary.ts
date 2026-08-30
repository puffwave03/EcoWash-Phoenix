/**
 * ACCOUNTING-001A canonical semantics:
 * - salesGross = active, non-cancelled priced order subtotal by orders.created_at;
 * - salesNet = the same orders' payable total after the canonical order discount;
 * - collectedGross/refunds = confirmed/refunded payment rows by payments.paid_at;
 * - collectedNet = collectedGross - refunds;
 * - outstanding = order total - lifetime confirmed collections. A payment refund is
 *   reported as a cash outflow and does not invent a new receivable without a
 *   canonical order adjustment/return event;
 * - invoice snapshots are documents, never an additional sale;
 * - pending/void payments and provider attempts are not money;
 * - undetailed Quick Drops are excluded until an active canonical item exists;
 * - currencies are never combined.
 */
export type AccountingPeriod = {
  endDateExclusive: string;
  startDate: string;
};

export type AccountingOrderFact = {
  activeItemCount: number;
  createdAt: string;
  currency: string;
  id: string;
  isQuickDrop: boolean;
  locationId: string | null;
  subtotal: number;
  total: number;
};

export type AccountingPaymentFact = {
  amount: number;
  channel: "online" | "order" | "pos";
  currency: string;
  id: string;
  locationId: string | null;
  method: "bank_transfer" | "card" | "cash" | "other";
  orderId: string;
  paidAt: string;
  posSessionId: string | null;
  status: "confirmed" | "pending" | "refunded" | "void";
};

export type AccountingPosSessionFact = {
  countedCash: number | null;
  currency: string;
  difference: number | null;
  expectedCash: number | null;
  id: string;
  locationId: string | null;
  openedAt: string;
  openingCash: number;
  status: "closed" | "open";
};

export type AccountingCurrencySummary = {
  bankTransferCollected: number;
  cardCollected: number;
  cashCollected: number;
  collectedGross: number;
  collectedNet: number;
  currency: string;
  discountTotal: number;
  onlineCollected: number;
  orderCount: number;
  orderIds: string[];
  otherCollected: number;
  outstanding: number;
  outstandingOrderCount: number;
  outstandingOrderIds: string[];
  paymentCount: number;
  paymentIds: string[];
  posCountedCash: number;
  posDifference: number;
  posExpectedCash: number;
  posOpeningCash: number;
  posSessionCount: number;
  posSessionIds: string[];
  refundCount: number;
  refundIds: string[];
  refunds: number;
  salesGross: number;
  salesNet: number;
};

export type AccountingSummary = {
  currencies: AccountingCurrencySummary[];
  dateBasis: {
    payments: "payments.paid_at";
    pos: "pos_sessions.opened_at";
    sales: "orders.created_at";
  };
  locationId: string | null;
  paymentPeriod: AccountingPeriod;
  salesPeriod: AccountingPeriod;
  timezone: string;
};

export type AccountingSummaryInput = {
  locationId: string | null;
  paymentPeriod: AccountingPeriod;
  periodPayments: AccountingPaymentFact[];
  posSessionPayments: AccountingPaymentFact[];
  posSessions: AccountingPosSessionFact[];
  receivableConfirmedPayments: AccountingPaymentFact[];
  salesOrders: AccountingOrderFact[];
  salesPeriod: AccountingPeriod;
  timezone: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = <T>(rows: T[], value: (row: T) => number) => round(rows.reduce((total, row) => total + value(row), 0));

export function localDateBoundaryUtc(date: string, timezone: string) {
  if (!DATE.test(date)) throw new Error("accounting_period_invalid");
  const [year, month, day] = date.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(guess - (represented - guess)).toISOString();
}

export function accountingPeriodBounds(period: AccountingPeriod, timezone: string) {
  if (period.endDateExclusive <= period.startDate) throw new Error("accounting_period_invalid");
  return {
    end: localDateBoundaryUtc(period.endDateExclusive, timezone),
    start: localDateBoundaryUtc(period.startDate, timezone),
  };
}

function empty(currency: string): AccountingCurrencySummary {
  return {
    bankTransferCollected: 0,
    cardCollected: 0,
    cashCollected: 0,
    collectedGross: 0,
    collectedNet: 0,
    currency,
    discountTotal: 0,
    onlineCollected: 0,
    orderCount: 0,
    orderIds: [],
    otherCollected: 0,
    outstanding: 0,
    outstandingOrderCount: 0,
    outstandingOrderIds: [],
    paymentCount: 0,
    paymentIds: [],
    posCountedCash: 0,
    posDifference: 0,
    posExpectedCash: 0,
    posOpeningCash: 0,
    posSessionCount: 0,
    posSessionIds: [],
    refundCount: 0,
    refundIds: [],
    refunds: 0,
    salesGross: 0,
    salesNet: 0,
  };
}

export function buildAccountingSummary(input: AccountingSummaryInput): AccountingSummary {
  const salesOrders = input.salesOrders.filter((order) => !(order.isQuickDrop && order.activeItemCount === 0));
  const currencies = new Set<string>([
    ...salesOrders.map((order) => order.currency),
    ...input.periodPayments.map((payment) => payment.currency),
    ...input.posSessions.map((session) => session.currency),
  ]);
  const summaries = [...currencies].sort().map((currency) => {
    const result = empty(currency);
    const orders = salesOrders.filter((order) => order.currency === currency);
    const payments = input.periodPayments.filter((payment) => payment.currency === currency);
    const confirmed = payments.filter((payment) => payment.status === "confirmed");
    const refunds = payments.filter((payment) => payment.status === "refunded");
    const allConfirmedByOrder = new Map<string, number>();
    for (const payment of input.receivableConfirmedPayments.filter((payment) => payment.currency === currency)) {
      allConfirmedByOrder.set(payment.orderId, round((allConfirmedByOrder.get(payment.orderId) ?? 0) + payment.amount));
    }

    result.orderIds = orders.map((order) => order.id);
    result.orderCount = orders.length;
    result.salesGross = sum(orders, (order) => order.subtotal);
    result.salesNet = sum(orders, (order) => order.total);
    result.discountTotal = round(result.salesGross - result.salesNet);
    for (const order of orders) {
      const due = round(Math.max(order.total - (allConfirmedByOrder.get(order.id) ?? 0), 0));
      result.outstanding = round(result.outstanding + due);
      if (due > 0) result.outstandingOrderIds.push(order.id);
    }
    result.outstandingOrderCount = result.outstandingOrderIds.length;

    result.paymentIds = confirmed.map((payment) => payment.id);
    result.paymentCount = confirmed.length;
    result.refundIds = refunds.map((payment) => payment.id);
    result.refundCount = refunds.length;
    result.collectedGross = sum(confirmed, (payment) => payment.amount);
    result.refunds = sum(refunds, (payment) => payment.amount);
    result.collectedNet = round(result.collectedGross - result.refunds);
    result.cashCollected = sum(confirmed.filter((payment) => payment.method === "cash"), (payment) => payment.amount);
    result.onlineCollected = sum(confirmed.filter((payment) => payment.channel === "online"), (payment) => payment.amount);
    result.cardCollected = sum(confirmed.filter((payment) => payment.method === "card" && payment.channel !== "online"), (payment) => payment.amount);
    result.bankTransferCollected = sum(confirmed.filter((payment) => payment.method === "bank_transfer"), (payment) => payment.amount);
    result.otherCollected = sum(confirmed.filter((payment) => payment.method === "other"), (payment) => payment.amount);

    const sessions = input.posSessions.filter((session) => session.currency === currency);
    result.posSessionIds = sessions.map((session) => session.id);
    result.posSessionCount = sessions.length;
    for (const session of sessions) {
      const sessionPayments = input.posSessionPayments.filter((payment) => payment.posSessionId === session.id);
      const cashIn = sum(sessionPayments.filter((payment) => payment.method === "cash" && payment.status === "confirmed"), (payment) => payment.amount);
      const cashOut = sum(sessionPayments.filter((payment) => payment.method === "cash" && payment.status === "refunded"), (payment) => payment.amount);
      const expected = session.expectedCash ?? round(session.openingCash + cashIn - cashOut);
      result.posOpeningCash = round(result.posOpeningCash + session.openingCash);
      result.posExpectedCash = round(result.posExpectedCash + expected);
      result.posCountedCash = round(result.posCountedCash + (session.countedCash ?? 0));
      result.posDifference = round(result.posDifference + (session.difference ?? 0));
    }
    return result;
  });

  return {
    currencies: summaries,
    dateBasis: { payments: "payments.paid_at", pos: "pos_sessions.opened_at", sales: "orders.created_at" },
    locationId: input.locationId,
    paymentPeriod: input.paymentPeriod,
    salesPeriod: input.salesPeriod,
    timezone: input.timezone,
  };
}
