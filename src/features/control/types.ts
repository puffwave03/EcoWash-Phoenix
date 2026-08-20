import type { MyDayActivityPriority, MyDayWorkflowStatus } from "@/features/work/types";

export type ControlActivityKind = "pickup" | "production" | "quality" | "delivery";
export type ControlExceptionSeverity = "critical" | "warning" | "info";
export type ControlExceptionType = "overdue" | "blocked" | "unassigned" | "upcoming";

export type ControlActivity = {
  assignedToName: string | null;
  customerName: string;
  href: string;
  id: string;
  kind: ControlActivityKind;
  orderNumber: string;
  priority: MyDayActivityPriority;
  propertyName: string | null;
  status: MyDayWorkflowStatus;
  timestamp: string | null;
};

export type ControlException = {
  assignedToName: string | null;
  customerName: string;
  href: string;
  id: string;
  kind: ControlActivityKind;
  orderNumber: string;
  propertyName: string | null;
  severity: ControlExceptionSeverity;
  status: MyDayWorkflowStatus;
  timestamp: string | null;
  type: ControlExceptionType;
};

export type TeamWorkload = {
  active: number;
  assigneeId: string;
  assigneeName: string | null;
  inProgress: number;
  isHighestLoad: boolean;
  overdue: number;
};

export type ControlCenterData = {
  exceptions: ControlException[];
  generatedAt: string;
  summary: {
    deliveries: number;
    inProgress: number;
    overdue: number;
    pickups: number;
    production: number;
    quality: number;
  };
  timeZone: string;
  upcoming: ControlActivity[];
  workload: TeamWorkload[];
};
