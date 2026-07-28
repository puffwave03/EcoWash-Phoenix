import { routing } from "@/i18n/routing";
import {
  CUSTOMER_STATUS_FILTERS,
  CUSTOMER_TYPES,
  PROPERTY_TYPES,
  type CustomerFormInput,
  type CustomerStatusFilter,
  type CustomerType,
  type PropertyFormInput,
  type PropertyType,
} from "@/features/customers/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d\s.-]{3,32}$/;

function text(formData: FormData, name: string, max = 180) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function nullable(value: string) {
  return value || null;
}

function isCustomerType(value: string): value is CustomerType {
  return CUSTOMER_TYPES.includes(value as CustomerType);
}

function isPropertyType(value: string): value is PropertyType {
  return PROPERTY_TYPES.includes(value as PropertyType);
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseStatusFilter(value: string | null): CustomerStatusFilter {
  return CUSTOMER_STATUS_FILTERS.includes(value as CustomerStatusFilter)
    ? (value as CustomerStatusFilter)
    : "active";
}

export function optionalDbValue(value: string) {
  return nullable(value);
}

export function parseCustomerForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const customerType = text(formData, "customerType", 32);
  const displayName = text(formData, "displayName", 160);
  const email = text(formData, "email", 160).toLowerCase();
  const phone = text(formData, "phone", 40);
  const alternatePhone = text(formData, "alternatePhone", 40);
  const billingCountryCode = text(formData, "billingCountryCode", 2).toUpperCase();
  const preferredLocale = text(formData, "preferredLocale", 2) || "es";

  if (!isCustomerType(customerType)) fieldErrors.customerType = "invalid";
  if (!displayName) fieldErrors.displayName = "required";
  if (email && !EMAIL_PATTERN.test(email)) fieldErrors.email = "invalid";
  if (phone && !PHONE_PATTERN.test(phone)) fieldErrors.phone = "invalid";
  if (alternatePhone && !PHONE_PATTERN.test(alternatePhone)) {
    fieldErrors.alternatePhone = "invalid";
  }
  if (billingCountryCode && billingCountryCode.length !== 2) {
    fieldErrors.billingCountryCode = "invalid";
  }
  if (!routing.locales.includes(preferredLocale as (typeof routing.locales)[number])) {
    fieldErrors.preferredLocale = "invalid";
  }

  const input: CustomerFormInput = {
    alternatePhone,
    billingAddressLine1: text(formData, "billingAddressLine1", 180),
    billingAddressLine2: text(formData, "billingAddressLine2", 180),
    billingCity: text(formData, "billingCity", 100),
    billingCountryCode: billingCountryCode || "ES",
    billingPostalCode: text(formData, "billingPostalCode", 24),
    companyName: text(formData, "companyName", 160),
    customerCode: text(formData, "customerCode", 80),
    customerType: isCustomerType(customerType) ? customerType : "individual",
    displayName,
    email,
    firstName: text(formData, "firstName", 100),
    isActive: formData.get("isActive") !== "false",
    lastName: text(formData, "lastName", 100),
    notes: text(formData, "notes", 2000),
    phone,
    preferredLocale,
    taxId: text(formData, "taxId", 80),
  };

  return { fieldErrors, input, valid: Object.keys(fieldErrors).length === 0 };
}

export function parsePropertyForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const customerId = text(formData, "customerId", 80);
  const propertyType = text(formData, "propertyType", 40);
  const name = text(formData, "name", 160);
  const contactPhone = text(formData, "contactPhone", 40);
  const countryCode = text(formData, "countryCode", 2).toUpperCase();

  if (!isUuid(customerId)) fieldErrors.customerId = "invalid";
  if (!name) fieldErrors.name = "required";
  if (propertyType && !isPropertyType(propertyType)) fieldErrors.propertyType = "invalid";
  if (contactPhone && !PHONE_PATTERN.test(contactPhone)) {
    fieldErrors.contactPhone = "invalid";
  }
  if (countryCode && countryCode.length !== 2) fieldErrors.countryCode = "invalid";

  const input: PropertyFormInput = {
    accessInstructions: text(formData, "accessInstructions", 1200),
    addressLine1: text(formData, "addressLine1", 180),
    addressLine2: text(formData, "addressLine2", 180),
    city: text(formData, "city", 100),
    contactName: text(formData, "contactName", 120),
    contactPhone,
    countryCode: countryCode || "ES",
    customerId,
    isActive: formData.get("isActive") !== "false",
    name,
    notes: text(formData, "notes", 2000),
    postalCode: text(formData, "postalCode", 24),
    propertyCode: text(formData, "propertyCode", 80),
    propertyType: isPropertyType(propertyType) ? propertyType : "",
  };

  return { fieldErrors, input, valid: Object.keys(fieldErrors).length === 0 };
}
