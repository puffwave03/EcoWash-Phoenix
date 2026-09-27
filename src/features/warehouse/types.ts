export type WarehousePositionType = "shelf" | "rack" | "hanger" | "cabinet" | "other";
export type OrderStorageMode = "folded" | "hanging" | "mixed" | "other";

export type WarehousePosition = {
  code: string;
  description: string | null;
  id: string;
  isActive: boolean;
  isDefaultInbound: boolean;
  locationId: string;
  name: string | null;
  positionType: WarehousePositionType;
};

export type WarehouseLocation = {
  id: string;
  isActive: boolean;
  name: string;
};

export type WarehousePositionActionState = {
  fieldErrors: Record<string, string>;
  formError: "defaultActive" | "defaultDeactivation" | "duplicate" | "generic" | "location" | "notFound" | null;
  success: boolean;
};

export type OrderStorageAssignment = {
  enteredAt: string;
  id: string;
  locationId: string;
  orderId: string;
  packageCount: number;
  positionCode: string;
  positionId: string;
  positionName: string | null;
  storageMode: OrderStorageMode;
};

export type OrderStorageActionState = {
  fieldErrors: Record<string, string>;
  formError: "generic" | "notFound" | "orderLocation" | "position" | null;
  success: boolean;
};

export type WarehouseMovement = {
  id: string;
  occurredAt: string;
  actorName: string | null;
  movementType: "entered" | "moved" | "updated" | "exited";
  source: "canonical_receipt" | "manual_assignment" | "manual_move" | "manual_update"
    | "customer_handoff" | "delivery_completed" | "cancelled_return";
  fromPositionLabel: string | null;
  toPositionLabel: string | null;
  fromPackageCount: number | null;
  toPackageCount: number | null;
  fromStorageMode: OrderStorageMode | null;
  toStorageMode: OrderStorageMode | null;
  note: string | null;
};
