import "server-only";

import type { DeliveryTask } from "@/features/deliveries/types";
import { getDeliveryWorkspaceData } from "@/features/deliveries/server/queries";
import type {
  ControlActivity,
  ControlActivityKind,
  ControlCenterData,
  ControlException,
  ControlExceptionSeverity,
  TeamWorkload,
} from "@/features/control/types";
import type { PickupTask } from "@/features/pickups/types";
import { getPickupWorkspaceData } from "@/features/pickups/server/queries";
import type { ProductionTask } from "@/features/production/types";
import { getProductionWorkspaceData } from "@/features/production/server/queries";
import type { MyDayActivity } from "@/features/work/types";
import { getMyDayData } from "@/features/work/server/queries";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

const QUALITY_STATUSES = ["quality_check", "packing"] as const;
const UPCOMING_LIMIT = 6;
const EXCEPTION_LIMIT = 8;

function productionKind(task: ProductionTask): ControlActivityKind {
  return QUALITY_STATUSES.includes(
    task.productionStatus as (typeof QUALITY_STATUSES)[number],
  )
    ? "quality"
    : "production";
}

function productionHref(task: ProductionTask) {
  return productionKind(task) === "quality"
    ? `/app/work/quality/${task.id}`
    : `/app/work/production/${task.id}`;
}

function activityHref(activity: MyDayActivity) {
  if (activity.kind === "pickup") {
    return `/app/work/pickups/${activity.id.slice("pickup-".length)}`;
  }
  if (activity.kind === "delivery") {
    return `/app/work/deliveries/${activity.id.slice("delivery-".length)}`;
  }
  if (activity.kind === "quality") return `/app/work/quality/${activity.orderId}`;

  return `/app/work/production/${activity.orderId}`;
}

function mapActivity(activity: MyDayActivity): ControlActivity {
  return {
    assignedToName: activity.assignedToName,
    customerName: activity.customerName,
    href: activityHref(activity),
    id: activity.id,
    kind: activity.kind,
    orderNumber: activity.orderNumber,
    priority: activity.priority,
    propertyName: activity.propertyName,
    status: activity.workflowStatus,
    timestamp: activity.timestamp,
  };
}

function productionException(task: ProductionTask): ControlException | null {
  let severity: ControlExceptionSeverity = "warning";
  let type: ControlException["type"] = "upcoming";

  if (task.productionStatus === "on_hold") {
    severity = task.urgency === "overdue" ? "critical" : "warning";
    type = "blocked";
  } else if (task.urgency === "overdue") {
    severity = "critical";
    type = "overdue";
  } else if (!task.assignedTo) {
    severity = "warning";
    type = "unassigned";
  } else if (task.urgency !== "due_soon") {
    return null;
  }

  return {
    assignedToName: task.assignedToName,
    customerName: task.customerName,
    href: productionHref(task),
    id: `production-${task.id}`,
    kind: productionKind(task),
    orderNumber: task.orderNumber,
    propertyName: task.propertyName,
    severity,
    status: task.productionStatus,
    timestamp: task.dueAt,
    type,
  };
}

function logisticsException(
  task: PickupTask | DeliveryTask,
  kind: "pickup" | "delivery",
): ControlException | null {
  if (task.priority !== "overdue" && task.priority !== "upcoming") return null;

  return {
    assignedToName: task.assignedToName,
    customerName: task.customerName,
    href: `/app/work/${kind === "pickup" ? "pickups" : "deliveries"}/${task.id}`,
    id: `${kind}-${task.id}`,
    kind,
    orderNumber: task.orderNumber,
    propertyName: task.propertyName,
    severity: task.priority === "overdue"
      ? "critical"
      : task.status === "in_progress"
        ? "info"
        : "warning",
    status: task.status,
    timestamp: task.scheduledAt,
    type: task.priority,
  };
}

function exceptionSort(a: ControlException, b: ControlException) {
  const severityRank: Record<ControlExceptionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const severityDiff = severityRank[a.severity] - severityRank[b.severity];

  if (severityDiff !== 0) return severityDiff;

  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

  if (aTime !== bTime) return aTime - bTime;

  return a.orderNumber.localeCompare(b.orderNumber);
}

type WorkloadAccumulator = Omit<TeamWorkload, "isHighestLoad">;

function teamWorkload(
  production: ProductionTask[],
  pickups: PickupTask[],
  deliveries: DeliveryTask[],
): TeamWorkload[] {
  const workload = new Map<string, WorkloadAccumulator>();
  const add = ({
    assigneeId,
    assigneeName,
    inProgress,
    overdue,
  }: {
    assigneeId: string | null;
    assigneeName: string | null;
    inProgress: boolean;
    overdue: boolean;
  }) => {
    if (!assigneeId) return;

    const current = workload.get(assigneeId) ?? {
      active: 0,
      assigneeId,
      assigneeName,
      inProgress: 0,
      overdue: 0,
    };
    current.active += 1;
    current.inProgress += inProgress ? 1 : 0;
    current.overdue += overdue ? 1 : 0;
    workload.set(assigneeId, current);
  };

  for (const task of production) {
    add({
      assigneeId: task.assignedTo,
      assigneeName: task.assignedToName,
      inProgress: task.group === "inProgress" || task.group === "toCheck",
      overdue: task.urgency === "overdue",
    });
  }
  for (const task of pickups) {
    add({
      assigneeId: task.assignedTo,
      assigneeName: task.assignedToName,
      inProgress: task.status === "in_progress",
      overdue: task.priority === "overdue",
    });
  }
  for (const task of deliveries) {
    add({
      assigneeId: task.assignedTo,
      assigneeName: task.assignedToName,
      inProgress: task.status === "in_progress",
      overdue: task.priority === "overdue",
    });
  }

  const rows = [...workload.values()].sort((a, b) => {
    if (a.overdue !== b.overdue) return b.overdue - a.overdue;
    if (a.active !== b.active) return b.active - a.active;

    return (a.assigneeName ?? a.assigneeId).localeCompare(
      b.assigneeName ?? b.assigneeId,
    );
  });
  const highestLoad = Math.max(0, ...rows.map((row) => row.active));

  return rows.map((row) => ({
    ...row,
    isHighestLoad: highestLoad > 0 && row.active === highestLoad,
  }));
}

export async function getControlCenterData(locale: string): Promise<ControlCenterData> {
  await requireOwnerOrManager(locale);

  const [myDay, pickupData, productionData, deliveryData] = await Promise.all([
    getMyDayData(locale),
    getPickupWorkspaceData(locale),
    getProductionWorkspaceData(locale),
    getDeliveryWorkspaceData(locale),
  ]);
  const qualityTasks = productionData.tasks.filter((task) =>
    QUALITY_STATUSES.includes(
      task.productionStatus as (typeof QUALITY_STATUSES)[number],
    ),
  );
  const productionTasks = productionData.tasks.filter(
    (task) =>
      !QUALITY_STATUSES.includes(
        task.productionStatus as (typeof QUALITY_STATUSES)[number],
      ) && task.productionStatus !== "ready",
  );
  const exceptions = [
    ...productionData.tasks.flatMap((task) => {
      const exception = productionException(task);

      return exception ? [exception] : [];
    }),
    ...pickupData.tasks.flatMap((task) => {
      const exception = logisticsException(task, "pickup");

      return exception ? [exception] : [];
    }),
    ...deliveryData.tasks.flatMap((task) => {
      const exception = logisticsException(task, "delivery");

      return exception ? [exception] : [];
    }),
  ].sort(exceptionSort).slice(0, EXCEPTION_LIMIT);

  return {
    exceptions,
    generatedAt: myDay.generatedAt,
    summary: {
      deliveries: deliveryData.tasks.length,
      inProgress: myDay.activities.filter((activity) => activity.isInProgress).length,
      overdue:
        productionData.tasks.filter((task) => task.urgency === "overdue").length +
        pickupData.tasks.filter((task) => task.priority === "overdue").length +
        deliveryData.tasks.filter((task) => task.priority === "overdue").length,
      pickups: pickupData.tasks.length,
      production: productionTasks.length,
      quality: qualityTasks.length,
    },
    timeZone: myDay.timeZone,
    upcoming: myDay.activities
      .filter((activity) => activity.priority !== "overdue")
      .slice(0, UPCOMING_LIMIT)
      .map(mapActivity),
    workload: teamWorkload(
      productionData.tasks,
      pickupData.tasks,
      deliveryData.tasks,
    ),
  };
}
