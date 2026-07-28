import "server-only";

import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type Customer,
  type CustomerListFilters,
  type Property,
} from "@/features/customers/types";

type CustomerRow = {
  alternate_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_country_code: string | null;
  billing_postal_code: string | null;
  company_name: string | null;
  customer_code: string | null;
  customer_type: Customer["customerType"];
  display_name: string;
  email: string | null;
  first_name: string | null;
  id: string;
  is_active: boolean;
  last_name: string | null;
  notes: string | null;
  phone: string | null;
  preferred_locale: string | null;
  tax_id: string | null;
  updated_at: string;
};

type PropertyRow = {
  access_instructions: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  customer_id: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  postal_code: string | null;
  property_code: string | null;
  property_type: Property["propertyType"];
  updated_at: string;
};

const CUSTOMER_SELECT =
  "id, customer_code, customer_type, display_name, first_name, last_name, company_name, tax_id, email, phone, alternate_phone, billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country_code, preferred_locale, notes, is_active, updated_at";
const PROPERTY_SELECT =
  "id, customer_id, property_code, name, property_type, address_line1, address_line2, city, postal_code, country_code, access_instructions, contact_name, contact_phone, notes, is_active, updated_at, customer:customers!inner(display_name)";

function mapCustomer(row: CustomerRow, propertyCount = 0): Customer {
  return {
    alternatePhone: row.alternate_phone,
    billingAddressLine1: row.billing_address_line1,
    billingAddressLine2: row.billing_address_line2,
    billingCity: row.billing_city,
    billingCountryCode: row.billing_country_code,
    billingPostalCode: row.billing_postal_code,
    companyName: row.company_name,
    customerCode: row.customer_code,
    customerType: row.customer_type,
    displayName: row.display_name,
    email: row.email,
    firstName: row.first_name,
    id: row.id,
    isActive: row.is_active,
    lastName: row.last_name,
    notes: row.notes,
    phone: row.phone,
    preferredLocale: row.preferred_locale,
    propertyCount,
    taxId: row.tax_id,
    updatedAt: row.updated_at,
  };
}

function customerName(row: PropertyRow["customer"]) {
  if (Array.isArray(row)) return row[0]?.display_name ?? "";

  return row?.display_name ?? "";
}

function mapProperty(row: PropertyRow): Property {
  return {
    accessInstructions: row.access_instructions,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    countryCode: row.country_code,
    customerDisplayName: customerName(row.customer),
    customerId: row.customer_id,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    notes: row.notes,
    postalCode: row.postal_code,
    propertyCode: row.property_code,
    propertyType: row.property_type,
    updatedAt: row.updated_at,
  };
}

export async function listCustomers(
  locale: string,
  filters: CustomerListFilters,
): Promise<Customer[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("organization_id", membership.organization.id)
    .order("display_name", { ascending: true })
    .limit(100);

  if (filters.status !== "all") {
    query = query.eq("is_active", filters.status === "active");
  }

  if (filters.query) {
    const search = filters.query.replaceAll("%", "").replaceAll(",", " ");
    query = query.or(
      `display_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%`,
    );
  }

  const [{ data, error }, { data: properties }] = await Promise.all([
    query.returns<CustomerRow[]>(),
    supabase
      .from("properties")
      .select("customer_id")
      .eq("organization_id", membership.organization.id)
      .returns<{ customer_id: string }[]>(),
  ]);

  if (error || !data) {
    console.error("Customer list query failed", error?.message);
    return [];
  }

  const counts = new Map<string, number>();
  properties?.forEach((property) => {
    counts.set(property.customer_id, (counts.get(property.customer_id) ?? 0) + 1);
  });

  return data.map((customer) => mapCustomer(customer, counts.get(customer.id) ?? 0));
}

export async function getCustomerById(locale: string, customerId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId)
    .maybeSingle<CustomerRow>();

  if (error || !data) notFound();

  const properties = await listPropertiesByCustomer(locale, customerId);

  return mapCustomer(data, properties.length);
}

export async function listProperties(locale: string): Promise<Property[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("organization_id", membership.organization.id)
    .order("name", { ascending: true })
    .returns<PropertyRow[]>();

  if (error || !data) {
    console.error("Property list query failed", error?.message);
    return [];
  }

  return data.map(mapProperty);
}

export async function listPropertiesByCustomer(
  locale: string,
  customerId: string,
): Promise<Property[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("customer_id", customerId)
    .order("name", { ascending: true })
    .returns<PropertyRow[]>();

  if (error || !data) {
    console.error("Customer properties query failed", error?.message);
    return [];
  }

  return data.map(mapProperty);
}

export async function getPropertyById(locale: string, propertyId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", propertyId)
    .maybeSingle<PropertyRow>();

  if (error || !data) notFound();

  return mapProperty(data);
}
