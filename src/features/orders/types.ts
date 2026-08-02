import type { ServiceUnitType } from "@/features/services/types";

export const PRODUCTION_STATUSES = [
  "draft",
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "ready",
  "completed",
  "on_hold",
  "cancelled",
] as const;
export const ORDER_PRIORITIES = ["normal", "express"] as const;
export const ORDER_STATUS_FILTERS = ["all", ...PRODUCTION_STATUSES] as const;
export const ACTIVE_FILTERS = ["active", "cancelled", "all"] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];
export type OrderPriority = (typeof ORDER_PRIORITIES)[number];
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];
export type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

export type Order = {
  assignedTo: string | null;
  assignedToName: string | null;
  completedAt: string | null;
  createdAt: string;
  currency: string;
  customerId: string;
  customerName: string;
  customerNotes: string | null;
  discountAmount: number;
  dueAt: string | null;
  id: string;
  internalNotes: string | null;
  isActive: boolean;
  orderNumber: string;
  priority: OrderPriority;
  productionStatus: ProductionStatus;
  propertyId: string | null;
  propertyName: string | null;
  subtotal: number;
  total: number;
};

export type OrderItem = {
  description: string;
  id: string;
  isActive: boolean;
  lineTotal: number;
  notes: string | null;
  quantity: number;
  serviceId: string | null;
  unitPrice: number;
  unitType: ServiceUnitType;
};

export type OrderHistory = {
  changedAt: string;
  changedByName: string | null;
  fromStatus: ProductionStatus | null;
  id: string;
  reason: string | null;
  toStatus: ProductionStatus;
};

export type OrderFormInput = {
  customerId: string;
  customerNotes: string;
  dueAt: string;
  internalNotes: string;
  locationId: string;
  priority: OrderPriority;
  propertyId: string;
};

export type OrderItemFormInput = {
  description: string;
  itemId: string;
  notes: string;
  orderId: string;
  quantity: number;
  serviceId: string;
  unitPrice: number;
  unitType: ServiceUnitType;
};

export type OrderActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  success?: boolean;
};

export type OrderListFilters = {
  active: ActiveFilter;
  priority: "all" | OrderPriority;
  query: string;
  status: OrderStatusFilter;
};
