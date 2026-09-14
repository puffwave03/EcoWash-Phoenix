export type CustomerHandoff = {
  balanceCurrency: string;
  balanceDueAtHandoff: number;
  completedAt: string;
  completedBy: string;
  completedByName: string | null;
  id: string;
  locationId: string | null;
  notes: string | null;
  orderId: string;
  unpaidBalanceAcknowledged: boolean;
};
