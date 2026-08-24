export const SERVICE_UNIT_TYPES = ["piece", "weight", "area", "cycle", "service", "day"] as const;
export const SERVICE_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export type ServiceUnitType = (typeof SERVICE_UNIT_TYPES)[number];
export type ServiceStatusFilter = (typeof SERVICE_STATUS_FILTERS)[number];

export type Service = {
  amount: number | null;
  category: string | null;
  code: string | null;
  currency: string | null;
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  priceIsFrom: boolean;
  unitType: ServiceUnitType;
  validFrom: string | null;
  validTo: string | null;
};

export function isDiscreteServiceUnit(unitType: ServiceUnitType) {
  return unitType === "piece" || unitType === "cycle" || unitType === "service" || unitType === "day";
}

export type ServiceFormInput = {
  amount: number;
  category: string;
  code: string;
  currency: string;
  description: string;
  isActive: boolean;
  name: string;
  priceIsFrom: boolean;
  unitType: ServiceUnitType;
  validFrom: string;
  validTo: string;
};

export type ServiceActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
};
