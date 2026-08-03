import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { OrderPhoto } from "@/features/order-photos/types";
import type { ServiceUnitType } from "@/features/services/types";

export type CustomerPortalAccess = {
  customerId: string;
  customerName: string;
  email: string | null;
  id: string;
  organizationId: string;
};

export type CustomerPortalOrder = {
  completedAt: string | null;
  createdAt: string;
  dueAt: string | null;
  id: string;
  orderNumber: string;
  productionStatus: ProductionStatus;
  propertyName: string | null;
};

export type CustomerPortalLogisticsRecord = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  completedAt: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  postalCode: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  status: FulfillmentStatus;
};

export type CustomerPortalLogistics = {
  delivery: CustomerPortalLogisticsRecord | null;
  pickup: CustomerPortalLogisticsRecord | null;
};

export type CustomerPortalOrderItem = {
  description: string;
  id: string;
  quantity: number;
  unitType: ServiceUnitType;
};

export type CustomerPortalHistoryEvent = {
  changedAt: string;
  id: string;
  toStatus: ProductionStatus;
};

export type CustomerPortalOrderDetail = CustomerPortalOrder & {
  history: CustomerPortalHistoryEvent[];
  items: CustomerPortalOrderItem[];
  logistics: CustomerPortalLogistics;
  photos: OrderPhoto[];
};

export type CustomerPortalNextTask = {
  kind: "delivery" | "pickup";
  orderId: string;
  orderNumber: string;
  scheduledAt: string;
  status: FulfillmentStatus;
};

export type CustomerPortalAccessSummary = {
  email: string;
  disabledAt: string | null;
  invitedAt: string;
  id: string;
  lastSignInAt: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type CustomerPortalActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  success: boolean;
  successKey?: string | null;
};
