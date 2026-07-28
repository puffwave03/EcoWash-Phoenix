export const CUSTOMER_TYPES = ["individual", "business"] as const;
export const PROPERTY_TYPES = [
  "apartment",
  "holiday_home",
  "hotel",
  "business",
  "other",
] as const;
export const CUSTOMER_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type CustomerStatusFilter = (typeof CUSTOMER_STATUS_FILTERS)[number];

export type Customer = {
  alternatePhone: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingCountryCode: string | null;
  billingPostalCode: string | null;
  companyName: string | null;
  customerCode: string | null;
  customerType: CustomerType;
  displayName: string;
  email: string | null;
  firstName: string | null;
  id: string;
  isActive: boolean;
  lastName: string | null;
  notes: string | null;
  phone: string | null;
  preferredLocale: string | null;
  propertyCount: number;
  taxId: string | null;
  updatedAt: string;
};

export type Property = {
  accessInstructions: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  contactName: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  customerDisplayName: string;
  customerId: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string | null;
  postalCode: string | null;
  propertyCode: string | null;
  propertyType: PropertyType | null;
  updatedAt: string;
};

export type CustomerFormInput = {
  alternatePhone: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingCountryCode: string;
  billingPostalCode: string;
  companyName: string;
  customerCode: string;
  customerType: CustomerType;
  displayName: string;
  email: string;
  firstName: string;
  isActive: boolean;
  lastName: string;
  notes: string;
  phone: string;
  preferredLocale: string;
  taxId: string;
};

export type PropertyFormInput = {
  accessInstructions: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  contactName: string;
  contactPhone: string;
  countryCode: string;
  customerId: string;
  isActive: boolean;
  name: string;
  notes: string;
  postalCode: string;
  propertyCode: string;
  propertyType: PropertyType | "";
};

export type ActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
};

export type CustomerListFilters = {
  query: string;
  status: CustomerStatusFilter;
};
