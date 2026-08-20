import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";

export type MyDayActivityKind = "pickup" | "production" | "quality" | "delivery";
export type MyDayActivityPriority = "overdue" | "in_progress" | "upcoming" | "scheduled" | "assigned";
export type MyDayWorkflowStatus = FulfillmentStatus | ProductionStatus;

export type MyDayActivity = {
  assignedToName: string | null;
  city: string | null;
  customerName: string;
  id: string;
  isInProgress: boolean;
  kind: MyDayActivityKind;
  orderId: string;
  orderNumber: string;
  priority: MyDayActivityPriority;
  propertyName: string | null;
  timestamp: string | null;
  workflowStatus: MyDayWorkflowStatus;
};

export type MyDayData = {
  activities: MyDayActivity[];
  generatedAt: string;
  isSupervision: boolean;
  nextActivity: MyDayActivity | null;
  profileName: string;
  summary: Record<MyDayActivityKind, number> & {
    total: number;
    urgent: number;
  };
  timeZone: string;
};
