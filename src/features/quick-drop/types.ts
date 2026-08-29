export type QuickDropDetailState = "detailed" | "pending_detail";
export type QuickDropFinancialState = "priced" | "unpriced";

export type QuickDropOrder = {
  customerId: string;
  detailState: QuickDropDetailState;
  dueAt: string | null;
  financialState: QuickDropFinancialState;
  id: string;
  orderCode: string;
  orderNumber: string;
  receivedAt: string;
};

export type PendingQuickDrop = {
  customerName: string;
  id: string;
  orderNumber: string;
  receivedAt: string;
};

export type QuickDropCreateResult = {
  error: "generic" | "validation" | null;
  order: QuickDropOrder | null;
};
