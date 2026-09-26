export type WarehousePositionType = "shelf" | "rack" | "hanger" | "cabinet" | "other";
export type OrderStorageMode = "folded" | "hanging" | "mixed" | "other";

export type WarehousePosition = {
  code: string;
  description: string | null;
  id: string;
  isActive: boolean;
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
  formError: "duplicate" | "generic" | "location" | "notFound" | null;
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
