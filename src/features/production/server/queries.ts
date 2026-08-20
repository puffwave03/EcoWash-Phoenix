import "server-only";

import { notFound } from "next/navigation";
import type {
  OrderPriority,
  ProductionStatus,
} from "@/features/orders/types";
import { getAllowedTransitions } from "@/features/orders/workflow";
import {
  relationName,
  todayWindow,
} from "@/features/operations/server/helpers";
import type {
  ProductionGroup,
  ProductionTask,
  ProductionTaskItem,
  ProductionUrgency,
  ProductionWorkspaceData,
} from "@/features/production/types";
import type { ServiceUnitType } from "@/features/services/types";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProductionItemRow = {
  description: string;
  is_active: boolean;
  notes: string | null;
  quantity: number;
  unit_type: ServiceUnitType;
};

type ProductionOrderRow = {
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  created_at: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  due_at: string | null;
  id: string;
  internal_notes: string | null;
  items: ProductionItemRow[] | null;
  on_hold_reason: string | null;
  order_number: string;
  priority: OrderPriority;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
};

type ProductionHistoryRow = {
  to_status: ProductionStatus;
};

const ACTIVE_PRODUCTION_STATUSES: ProductionStatus[] = [
  "draft",
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "ready",
  "on_hold",
];
const PROCESSING_STATUSES: ProductionStatus[] = [
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "on_hold",
];
const DUE_SOON_WINDOW_MS = 2 * 60 * 60 * 1000;
const PRODUCTION_SELECT =
  "id, order_number, production_status, priority, due_at, assigned_to, internal_notes, on_hold_reason, created_at, customer:customers!orders_customer_same_organization!inner(display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name), items:order_items!order_items_order_same_organization(description, unit_type, quantity, notes, is_active)";

function groupForStatus(status: ProductionStatus): ProductionGroup {
  if (["draft", "received"].includes(status)) return "toStart";
  if (["quality_check", "packing"].includes(status)) return "toCheck";
  if (status === "ready") return "ready";

  return "inProgress";
}

function urgencyForOrder(
  row: ProductionOrderRow,
  now: Date,
): ProductionUrgency {
  if (row.due_at && new Date(row.due_at) < now) return "overdue";
  if (PROCESSING_STATUSES.includes(row.production_status)) return "in_progress";
  if (
    row.due_at &&
    new Date(row.due_at).getTime() <= now.getTime() + DUE_SOON_WINDOW_MS
  ) {
    return "due_soon";
  }
  if (row.due_at) return "scheduled";

  return "unscheduled";
}

function activeItems(items: ProductionItemRow[] | null): ProductionTaskItem[] {
  return (items ?? [])
    .filter((item) => item.is_active)
    .map((item) => ({
      description: item.description,
      notes: item.notes,
      quantity: Number(item.quantity),
      unitType: item.unit_type,
    }));
}

function previousProductionStatus(history: ProductionHistoryRow[]) {
  return history.find(
    (entry) => !["on_hold", "cancelled", "completed"].includes(entry.to_status),
  )?.to_status ?? null;
}

function mapProductionTask(
  row: ProductionOrderRow,
  now: Date,
  previousStatus: ProductionStatus | null = null,
): ProductionTask {
  const items = activeItems(row.items);

  return {
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    customerName: relationName(row.customer) ?? "",
    dueAt: row.due_at,
    group: groupForStatus(row.production_status),
    id: row.id,
    items,
    note: row.internal_notes,
    onHoldReason: row.on_hold_reason,
    orderNumber: row.order_number,
    previousStatus,
    priority: row.priority,
    productionStatus: row.production_status,
    propertyName: relationName(row.property),
    serviceNames: [...new Set(items.map((item) => item.description))],
    totalPieces: items
      .filter((item) => item.unitType === "piece")
      .reduce((total, item) => total + item.quantity, 0),
    totalWeight: items
      .filter((item) => item.unitType === "weight")
      .reduce((total, item) => total + item.quantity, 0),
    urgency: urgencyForOrder(row, now),
  };
}

function productionTaskSort(a: ProductionTask, b: ProductionTask) {
  const urgencyRank: Record<ProductionUrgency, number> = {
    overdue: 0,
    in_progress: 1,
    due_soon: 2,
    scheduled: 3,
    unscheduled: 4,
  };
  const urgencyDifference = urgencyRank[a.urgency] - urgencyRank[b.urgency];

  if (urgencyDifference !== 0) return urgencyDifference;

  const aDueAt = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bDueAt = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

  if (aDueAt !== bDueAt) return aDueAt - bDueAt;
  if (a.priority !== b.priority) return a.priority === "express" ? -1 : 1;

  return a.orderNumber.localeCompare(b.orderNumber);
}

export async function getProductionWorkspaceData(
  locale: string,
): Promise<ProductionWorkspaceData> {
  const { membership, profile } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { now, timeZone } = todayWindow(membership.organization.timezone);
  const isSupervision = membership.role === "owner" || membership.role === "manager";
  let query = supabase
    .from("orders")
    .select(PRODUCTION_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .in("production_status", ACTIVE_PRODUCTION_STATUSES)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(150);

  if (!isSupervision) query = query.eq("assigned_to", profile.id);

  const { data, error } = await query.returns<ProductionOrderRow[]>();

  if (error) console.error("Production workspace query failed", error.code);

  const tasks = (data ?? [])
    .map((row) => mapProductionTask(row, now))
    .sort(productionTaskSort);

  return {
    generatedAt: now.toISOString(),
    isSupervision,
    nextOrder: tasks[0] ?? null,
    summary: {
      inProgress: tasks.filter((task) => task.group === "inProgress").length,
      ready: tasks.filter((task) => task.group === "ready").length,
      toCheck: tasks.filter((task) => task.group === "toCheck").length,
      toStart: tasks.filter((task) => task.group === "toStart").length,
      total: tasks.length,
    },
    tasks,
    timeZone,
  };
}

export async function getProductionWorkspaceTask(
  locale: string,
  orderId: string,
) {
  const { membership, profile } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { now, timeZone } = todayWindow(membership.organization.timezone);
  const isSupervision = membership.role === "owner" || membership.role === "manager";
  let query = supabase
    .from("orders")
    .select(PRODUCTION_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", orderId)
    .eq("is_active", true)
    .in("production_status", ACTIVE_PRODUCTION_STATUSES);

  if (!isSupervision) query = query.eq("assigned_to", profile.id);

  const { data, error } = await query.maybeSingle<ProductionOrderRow>();

  if (error || !data) notFound();

  const { data: historyData, error: historyError } = await supabase
    .from("order_status_history")
    .select("to_status")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false })
    .returns<ProductionHistoryRow[]>();

  if (historyError) console.error("Production task history query failed", historyError.code);

  const previousStatus = previousProductionStatus(historyData ?? []);
  const task = mapProductionTask(data, now, previousStatus);

  return {
    allowedTransitions: getAllowedTransitions(task.productionStatus, previousStatus),
    isSupervision,
    task,
    timeZone,
  };
}
