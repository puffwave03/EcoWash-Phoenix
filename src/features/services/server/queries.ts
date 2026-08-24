import "server-only";

import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Service, ServiceStatusFilter } from "@/features/services/types";

type ServiceRow = {
  category: string | null;
  code: string | null;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
  unit_type: Service["unitType"];
  price: {
    amount: number;
    currency: string;
    is_from: boolean;
    valid_from: string;
    valid_to: string | null;
  } | {
    amount: number;
    currency: string;
    is_from: boolean;
    valid_from: string;
    valid_to: string | null;
  }[] | null;
};

const SERVICE_SELECT =
  "id, code, name, description, unit_type, category, is_active, price:service_prices(amount, currency, is_from, valid_from, valid_to)";

function currentDateInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");

  if (!year || !month || !day) {
    throw new Error("Unable to resolve the organization date");
  }

  return `${year}-${month}-${day}`;
}

function currentPrice(row: ServiceRow["price"]) {
  if (Array.isArray(row)) return row[0] ?? null;

  return row;
}

function mapService(row: ServiceRow): Service {
  const price = currentPrice(row.price);

  return {
    amount: price?.amount ?? null,
    category: row.category,
    code: row.code,
    currency: price?.currency ?? null,
    description: row.description,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    priceIsFrom: price?.is_from ?? false,
    unitType: row.unit_type,
    validFrom: price?.valid_from ?? null,
    validTo: price?.valid_to ?? null,
  };
}

export async function listServices(
  locale: string,
  status: ServiceStatusFilter = "active",
): Promise<Service[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const currentDate = currentDateInTimeZone(membership.organization.timezone);
  let query = supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("price.is_active", true)
    .lte("price.valid_from", currentDate)
    .or(`valid_to.is.null,valid_to.gte.${currentDate}`, { referencedTable: "price" })
    .order("location_id", { ascending: true, nullsFirst: false, referencedTable: "price" })
    .order("valid_from", { ascending: false, referencedTable: "price" })
    .order("created_at", { ascending: false, referencedTable: "price" })
    .limit(1, { referencedTable: "price" })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (status !== "all") query = query.eq("is_active", status === "active");

  const { data, error } = await query.returns<ServiceRow[]>();

  if (error || !data) {
    console.error("Service list query failed", error?.code);
    return [];
  }

  return data.map(mapService);
}

export async function listActiveServicesForOrder(locale: string) {
  const services = await listServices(locale, "active");

  return services.filter((service) => service.amount !== null);
}

export async function getServiceById(locale: string, serviceId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const currentDate = currentDateInTimeZone(membership.organization.timezone);
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("price.is_active", true)
    .lte("price.valid_from", currentDate)
    .or(`valid_to.is.null,valid_to.gte.${currentDate}`, { referencedTable: "price" })
    .order("location_id", { ascending: true, nullsFirst: false, referencedTable: "price" })
    .order("valid_from", { ascending: false, referencedTable: "price" })
    .order("created_at", { ascending: false, referencedTable: "price" })
    .limit(1, { referencedTable: "price" })
    .eq("id", serviceId)
    .maybeSingle<ServiceRow>();

  if (error || !data) notFound();

  return mapService(data);
}
