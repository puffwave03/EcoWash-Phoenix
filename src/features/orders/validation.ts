import {
  ACTIVE_FILTERS,
  ORDER_PRIORITIES,
  ORDER_STATUS_FILTERS,
  PRODUCTION_STATUSES,
  type ActiveFilter,
  type OrderFormInput,
  type OrderItemFormInput,
  type OrderListFilters,
  type OrderPriority,
  type OrderStatusFilter,
  type ProductionStatus,
} from "@/features/orders/types";
import {
  isDiscreteServiceUnit,
  SERVICE_UNIT_TYPES,
  type ServiceUnitType,
} from "@/features/services/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function text(formData: FormData, name: string, max = 180) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalUuid(value: string) {
  return value === "" || UUID_PATTERN.test(value);
}

function isPriority(value: string): value is OrderPriority {
  return ORDER_PRIORITIES.includes(value as OrderPriority);
}

function isUnitType(value: string): value is ServiceUnitType {
  return SERVICE_UNIT_TYPES.includes(value as ServiceUnitType);
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function optionalDbValue(value: string) {
  return value || null;
}

export function parseOrderFilters(input: {
  active?: string;
  priority?: string;
  q?: string;
  status?: string;
}): OrderListFilters {
  const status = ORDER_STATUS_FILTERS.includes(input.status as OrderStatusFilter)
    ? (input.status as OrderStatusFilter)
    : "all";
  const active = ACTIVE_FILTERS.includes(input.active as ActiveFilter)
    ? (input.active as ActiveFilter)
    : "active";
  const priority = ORDER_PRIORITIES.includes(input.priority as OrderPriority)
    ? (input.priority as OrderPriority)
    : "all";

  return {
    active,
    priority,
    query: String(input.q ?? "").trim().slice(0, 80),
    status,
  };
}

export function parseOrderForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const customerId = text(formData, "customerId", 80);
  const propertyId = text(formData, "propertyId", 80);
  const locationId = text(formData, "locationId", 80);
  const priority = text(formData, "priority", 16);
  const dueAt = text(formData, "dueAt", 16);

  if (!isUuid(customerId)) fieldErrors.customerId = "invalid";
  if (!optionalUuid(propertyId)) fieldErrors.propertyId = "invalid";
  if (!optionalUuid(locationId)) fieldErrors.locationId = "invalid";
  if (!isPriority(priority)) fieldErrors.priority = "invalid";
  if (dueAt && !DATE_TIME_PATTERN.test(dueAt)) fieldErrors.dueAt = "invalid";

  const input: OrderFormInput = {
    customerId,
    customerNotes: text(formData, "customerNotes", 1000),
    dueAt,
    internalNotes: text(formData, "internalNotes", 1000),
    locationId,
    priority: isPriority(priority) ? priority : "normal",
    propertyId,
  };

  return { fieldErrors, input, valid: Object.keys(fieldErrors).length === 0 };
}

export function parseOrderItemForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const itemId = text(formData, "itemId", 80);
  const orderId = text(formData, "orderId", 80);
  const serviceId = text(formData, "serviceId", 80);
  const description = text(formData, "description", 180);
  const unitType = text(formData, "unitType", 16);
  const quantity = Number(text(formData, "quantity", 24));
  const unitPrice = Number(text(formData, "unitPrice", 24));

  if (itemId && !isUuid(itemId)) fieldErrors.itemId = "invalid";
  if (!isUuid(orderId)) fieldErrors.orderId = "invalid";
  if (!optionalUuid(serviceId)) fieldErrors.serviceId = "invalid";
  if (!description && !serviceId) fieldErrors.description = "required";
  if (!isUnitType(unitType)) fieldErrors.unitType = "invalid";
  if (!Number.isFinite(quantity) || quantity <= 0) fieldErrors.quantity = "invalid";
  if (isUnitType(unitType) && isDiscreteServiceUnit(unitType) && !Number.isInteger(quantity)) fieldErrors.quantity = "integer";
  if (!Number.isFinite(unitPrice) || unitPrice < 0) fieldErrors.unitPrice = "invalid";

  const input: OrderItemFormInput = {
    description,
    itemId,
    notes: text(formData, "notes", 600),
    orderId,
    quantity,
    serviceId,
    unitPrice: Number.isFinite(unitPrice) ? Math.round(unitPrice * 100) / 100 : 0,
    unitType: isUnitType(unitType) ? unitType : "piece",
  };

  return { fieldErrors, input, valid: Object.keys(fieldErrors).length === 0 };
}

export function parseProductionStatus(value: string): ProductionStatus | null {
  return PRODUCTION_STATUSES.includes(value as ProductionStatus)
    ? (value as ProductionStatus)
    : null;
}
