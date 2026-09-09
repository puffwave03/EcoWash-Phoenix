import type { FulfillmentStatus } from "@/features/logistics/types";

export type PickupPriority =
  | "overdue"
  | "in_progress"
  | "upcoming"
  | "scheduled"
  | "assigned";

export type PickupTask = {
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
  priority: PickupPriority;
  propertyName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  status: FulfillmentStatus;
};

export type CompletedPickupTask = {
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

export type PickupWorkspaceData = {
  completedToday: CompletedPickupTask[];
  generatedAt: string;
  isSupervision: boolean;
  nextPickup: PickupTask | null;
  summary: {
    inProgress: number;
    overdue: number;
    toDo: number;
    total: number;
  };
  tasks: PickupTask[];
  timeZone: string;
};
