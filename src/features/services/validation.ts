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

export function parseServiceForm(formData: FormData, defaultCurrency: string, allowEmptyPrice = false) {
  const fieldErrors: Record<string, string> = {};
  const name = requiredName(formData);
  const unitType = text(formData, "unitType", 24);
  const amountText = text(formData, "amount", 24);
  const amount = Number(amountText);
  const currency = (text(formData, "currency", 3) || defaultCurrency).toUpperCase();
  const validFrom = text(formData, "validFrom", 10);
  const validTo = text(formData, "validTo", 10);
  const priceIsFrom = formData.get("priceIsFrom");

  if (!name) fieldErrors.name = "required";
  else if (name.length > 160) fieldErrors.name = "invalid";
  if (!isUnitType(unitType)) fieldErrors.unitType = "invalid";
  if (!(allowEmptyPrice && !amountText)
    && (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount))) fieldErrors.amount = "invalid";
  if (currency !== defaultCurrency) fieldErrors.currency = "invalid";
  if (priceIsFrom !== "true" && priceIsFrom !== "false") fieldErrors.priceIsFrom = "invalid";
  const validDate = (value: string) => DATE_PATTERN.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(validFrom)) fieldErrors.validFrom = "invalid";
  if (validTo && !validDate(validTo)) fieldErrors.validTo = "invalid";
  if (validTo && validFrom && validTo < validFrom) fieldErrors.validTo = "invalid";

  const input: ServiceFormInput = {
    amount: amountText && Number.isFinite(amount) ? amount : null,
    category: text(formData, "category", 100),
    code: text(formData, "code", 80),
    currency,
    description: text(formData, "description", 600),
    isActive: formData.get("isActive") !== "false",
    name,
    priceIsFrom: priceIsFrom === "true",
    unitType: isUnitType(unitType) ? unitType : "piece",
    validFrom,
    validTo,
  };

  return { fieldErrors, input, valid: Object.keys(fieldErrors).length === 0 };
}
