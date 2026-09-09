import type { FulfillmentStatus } from "@/features/logistics/types";

export type DeliveryPriority =
  | "overdue"
  | "in_progress"
  | "upcoming"
  | "scheduled"
  | "assigned";

export type DeliveryTask = {
  addressLine1: string | null;
  addressLine2: string | null;
  assignedTo: string;
  assignedToName: string | null;
  city: string | null;
  contactName: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  customerName: string;
  id: string;
  notes: string | null;
  orderId: string;
  orderNumber: string;
  postalCode: string | null;
  priority: DeliveryPriority;
  propertyName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  status: FulfillmentStatus;
};

export type CompletedDeliveryTask = {
  addressLine1: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  city: string | null;
  completedAt: string;
  customerName: string;
  id: string;
  orderNumber: string;
  propertyName: string | null;
  status: "completed";
};

export type DeliveryWorkspaceData = {
  completedToday: CompletedDeliveryTask[];
  generatedAt: string;
  isSupervision: boolean;
  nextDelivery: DeliveryTask | null;
  summary: {
    inProgress: number;
    overdue: number;
    toDo: number;
    total: number;
  };
  tasks: DeliveryTask[];
  timeZone: string;
};
