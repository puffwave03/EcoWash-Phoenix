import type { ServiceUnitType } from "@/features/services/types";

// Commercial service evidence. No prices, financial ledger or fiscal semantics.
export type ServiceAlbaranSnapshot = {
  version: 1;
  document: { number: string; issuedAt: string };
  organization: { id: string; name: string; timezone: string };
  location: { id: string; name: string };
  customer: { id: string; name: string };
  property: { id: string; name: string } | null;
  order: { id: string; number: string };
  completion: { eventId: string; recordedAt: string };
  items: { id: string; description: string; quantity: number; unitType: ServiceUnitType }[];
};

export type ServiceAlbaran = {
  id: string;
  order_id: string;
  document_number: string;
  document_status: "issued" | "cancelled";
  issued_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  snapshot_version: 1;
  snapshot: ServiceAlbaranSnapshot;
};
