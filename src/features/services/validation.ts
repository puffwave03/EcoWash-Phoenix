import {
  SERVICE_STATUS_FILTERS,
  SERVICE_UNIT_TYPES,
  type ServiceFormInput,
  type ServiceStatusFilter,
  type ServiceUnitType,
} from "@/features/services/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, name: string, max = 180) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function requiredName(formData: FormData) {
  return String(formData.get("name") ?? "").trim();
}

function isUnitType(value: string): value is ServiceUnitType {
  return SERVICE_UNIT_TYPES.includes(value as ServiceUnitType);
}

export function optionalDbValue(value: string) {
  return value || null;
}

export function parseServiceStatusFilter(value: string | null): ServiceStatusFilter {
  return SERVICE_STATUS_FILTERS.includes(value as ServiceStatusFilter)
    ? (value as ServiceStatusFilter)
    : "active";
}

export function parseServiceForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const name = requiredName(formData);
  const unitType = text(formData, "unitType", 24);
  const amountText = text(formData, "amount", 24);
  const amount = Number(amountText);
  const currency = (text(formData, "currency", 3) || "EUR").toUpperCase();
  const validFrom = text(formData, "validFrom", 10);
  const validTo = text(formData, "validTo", 10);

  if (!name) fieldErrors.name = "required";
  else if (name.length > 160) fieldErrors.name = "invalid";
  if (!isUnitType(unitType)) fieldErrors.unitType = "invalid";
  if (!Number.isFinite(amount) || amount < 0) fieldErrors.amount = "invalid";
  if (currency.length !== 3) fieldErrors.currency = "invalid";
  if (!DATE_PATTERN.test(validFrom)) fieldErrors.validFrom = "invalid";
  if (validTo && !DATE_PATTERN.test(validTo)) fieldErrors.validTo = "invalid";
  if (validTo && validFrom && validTo < validFrom) fieldErrors.validTo = "invalid";

  const input: ServiceFormInput = {
    amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
    category: text(formData, "category", 100),
    code: text(formData, "code", 80),
    currency,
    description: text(formData, "description", 600),
    isActive: formData.get("isActive") !== "false",
    name,
    priceIsFrom: formData.get("priceIsFrom") === "true",
    unitType: isUnitType(unitType) ? unitType : "piece",
    validFrom,
    validTo,
  };

  return { fieldErrors, input, valid: Object.keys(fieldErrors).length === 0 };
}
