export type DailyCloseSnapshotWarning = {
  code: string;
  count: number;
};

export type DailyCloseSnapshotPayment = {
  collectedNet: number;
  confirmedPaymentCount: number;
  currency: string;
  refundCount: number;
  refunds: number;
};

export type DailyCloseSnapshotSummary = {
  finalFulfillmentCompleted: number;
  logistics: {
    completedDeliveries: number;
    completedPickups: number;
    deliveriesDueOpen: number;
    inProgress: number;
    pickupsDueOpen: number;
  };
  ordersCreated: number;
  payments: DailyCloseSnapshotPayment[];
  pos: {
    countedCash: number;
    currency: string;
    expectedCash: number;
    variance: number;
  };
  productionCompleted: number;
  warnings: DailyCloseSnapshotWarning[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function string(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringArrayLength(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.length
    : null;
}

function warnings(value: unknown): DailyCloseSnapshotWarning[] | null {
  if (!Array.isArray(value)) return null;

  const result: DailyCloseSnapshotWarning[] = [];
  for (const item of value) {
    const row = record(item);
    const code = string(row?.code);
    const count = number(row?.count);
    if (!code || count === null) return null;
    result.push({ code, count });
  }
  return result;
}

function payments(value: unknown): DailyCloseSnapshotPayment[] | null {
  if (!Array.isArray(value)) return null;

  const result: DailyCloseSnapshotPayment[] = [];
  for (const item of value) {
    const row = record(item);
    const currency = string(row?.currency);
    const confirmedPaymentCount = number(row?.confirmedPaymentCount);
    const collectedNet = number(row?.collectedNet);
    const refundCount = number(row?.refundCount);
    const refunds = number(row?.refunds);
    if (!currency || confirmedPaymentCount === null || collectedNet === null || refundCount === null || refunds === null) return null;
    result.push({ collectedNet, confirmedPaymentCount, currency, refundCount, refunds });
  }
  return result;
}

export function readDailyCloseSnapshot(value: unknown): DailyCloseSnapshotSummary | null {
  const snapshot = record(value);
  const orders = record(snapshot?.orders);
  const finalFulfillment = record(snapshot?.finalFulfillment);
  const pos = record(snapshot?.pos);
  const logistics = record(snapshot?.logistics);
  const ordersCreated = number(orders?.created);
  const productionCompleted = number(orders?.productionCompleted);
  const finalFulfillmentCompleted = number(finalFulfillment?.completedOrderCount);
  const expectedCash = number(pos?.expectedCash);
  const countedCash = number(pos?.countedCash);
  const variance = number(pos?.variance);
  const currency = string(pos?.currency);
  const pickupsDueOpen = number(logistics?.pickupsDueOpen);
  const deliveriesDueOpen = number(logistics?.deliveriesDueOpen);
  const inProgress = number(logistics?.inProgress);
  const completedPickups = stringArrayLength(logistics?.completedPickupIds);
  const completedDeliveries = stringArrayLength(logistics?.completedDeliveryIds);
  const snapshotPayments = payments(snapshot?.payments);
  const snapshotWarnings = warnings(snapshot?.warnings);

  if (
    ordersCreated === null
    || productionCompleted === null
    || finalFulfillmentCompleted === null
    || expectedCash === null
    || countedCash === null
    || variance === null
    || !currency
    || pickupsDueOpen === null
    || deliveriesDueOpen === null
    || inProgress === null
    || completedPickups === null
    || completedDeliveries === null
    || snapshotPayments === null
    || snapshotWarnings === null
  ) return null;

  return {
    finalFulfillmentCompleted,
    logistics: {
      completedDeliveries,
      completedPickups,
      deliveriesDueOpen,
      inProgress,
      pickupsDueOpen,
    },
    ordersCreated,
    payments: snapshotPayments,
    pos: { countedCash, currency, expectedCash, variance },
    productionCompleted,
    warnings: snapshotWarnings,
  };
}
