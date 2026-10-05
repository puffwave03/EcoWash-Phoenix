export type AccountantCurrencyTotals = {
  orderCount: number;
  salesNet: number;
  paymentCount: number;
  collectedGross: number;
  refundCount: number;
  refunds: number;
  cashCollected: number;
  cardCollected: number;
  bankTransferCollected: number;
  otherCollected: number;
  onlineCollected: number;
  postedExpenseCount: number;
  postedExpenses: number;
};

type MonetaryEvent = {
  amount: number | string;
  currency: string;
  event_type: "sale" | "payment" | "refund";
  payment_method: string | null;
};

function cents(value: number | string) {
  return Math.round(Number(value) * 100);
}

function totalsFor(map: Map<string, AccountantCurrencyTotals>, currency: string) {
  let totals = map.get(currency);
  if (!totals) {
    totals = {
      orderCount: 0, salesNet: 0, paymentCount: 0, collectedGross: 0,
      refundCount: 0, refunds: 0, cashCollected: 0, cardCollected: 0,
      bankTransferCollected: 0, otherCollected: 0, onlineCollected: 0,
      postedExpenseCount: 0, postedExpenses: 0,
    };
    map.set(currency, totals);
  }
  return totals;
}

export function addAccountantSalesEvent(
  map: Map<string, AccountantCurrencyTotals>,
  event: MonetaryEvent,
  paymentChannel?: string,
) {
  const total = totalsFor(map, event.currency);
  const amount = cents(event.amount);
  if (event.event_type === "sale") {
    total.orderCount += 1;
    total.salesNet += amount;
  } else if (event.event_type === "refund") {
    total.refundCount += 1;
    total.refunds += amount;
  } else {
    if (!paymentChannel) throw new Error("accounting_summary_payment_channel_missing");
    total.paymentCount += 1;
    total.collectedGross += amount;
    if (paymentChannel === "online") total.onlineCollected += amount;
    if (event.payment_method === "card" && paymentChannel !== "online") total.cardCollected += amount;
    if (event.payment_method === "cash") total.cashCollected += amount;
    if (event.payment_method === "bank_transfer") total.bankTransferCollected += amount;
    if (event.payment_method === "other") total.otherCollected += amount;
  }
}

export function addAccountantPostedExpense(
  map: Map<string, AccountantCurrencyTotals>,
  expense: { currency: string; gross_amount: number | string; status: string },
) {
  if (expense.status !== "posted") return;
  const total = totalsFor(map, expense.currency);
  total.postedExpenseCount += 1;
  total.postedExpenses += cents(expense.gross_amount);
}
