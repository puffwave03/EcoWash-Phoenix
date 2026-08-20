import type {
  OrderPriority,
  ProductionStatus,
} from "@/features/orders/types";
import type { ServiceUnitType } from "@/features/services/types";

export type ProductionGroup =
  | "toStart"
  | "inProgress"
  | "toCheck"
  | "ready";

export type ProductionUrgency =
  | "overdue"
  | "in_progress"
  | "due_soon"
  | "scheduled"
  | "unscheduled";

export type ProductionTaskItem = {
  description: string;
  notes: string | null;
  quantity: number;
  unitType: ServiceUnitType;
};

export type ProductionTask = {
  assignedTo: string | null;
  assignedToName: string | null;
  customerName: string;
  dueAt: string | null;
  group: ProductionGroup;
  id: string;
  items: ProductionTaskItem[];
  note: string | null;
  onHoldReason: string | null;
  orderNumber: string;
  previousStatus: ProductionStatus | null;
  priority: OrderPriority;
  productionStatus: ProductionStatus;
  propertyName: string | null;
  serviceNames: string[];
  totalPieces: number;
  totalWeight: number;
  urgency: ProductionUrgency;
};

export type ProductionWorkspaceData = {
  generatedAt: string;
  isSupervision: boolean;
  nextOrder: ProductionTask | null;
  summary: Record<ProductionGroup, number> & { total: number };
  tasks: ProductionTask[];
  timeZone: string;
};

export type QualityGroup = "toCheck" | "toPack";

export type QualityWorkspaceData = {
  generatedAt: string;
  isSupervision: boolean;
  nextOrder: ProductionTask | null;
  summary: Record<QualityGroup, number> & { total: number };
  tasks: ProductionTask[];
  timeZone: string;
};
