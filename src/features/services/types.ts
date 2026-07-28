export const SERVICE_UNIT_TYPES = ["weight", "piece"] as const;
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
  unitType: ServiceUnitType;
  validFrom: string | null;
  validTo: string | null;
};

export type ServiceFormInput = {
  amount: number;
  category: string;
  code: string;
  currency: string;
  description: string;
  isActive: boolean;
  name: string;
  unitType: ServiceUnitType;
  validFrom: string;
  validTo: string;
};

export type ServiceActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
};
