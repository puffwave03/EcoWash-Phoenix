export const FULFILLMENT_STATUSES = [
  "not_required",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export type LogisticsRecord = {
  addressLine1: string | null;
  addressLine2: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  cancellationReason: string | null;
  city: string | null;
  completedAt: string | null;
  contactName: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  fee: number;
  id: string;
  notes: string | null;
  postalCode: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  status: FulfillmentStatus;
};

export type OrderLogistics = {
  delivery: LogisticsRecord | null;
  pickup: LogisticsRecord | null;
};

export type LogisticsActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
};
