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
    valid_from: string;
    valid_to: string | null;
  } | {
    amount: number;
    currency: string;
    valid_from: string;
    valid_to: string | null;
  }[] | null;
};

const SERVICE_SELECT =
  "id, code, name, description, unit_type, category, is_active, price:service_prices(amount, currency, valid_from, valid_to)";

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
  let query = supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("organization_id", membership.organization.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(100);

  if (status !== "all") query = query.eq("is_active", status === "active");

  const { data, error } = await query.returns<ServiceRow[]>();

  if (error || !data) {
    console.error("Service list query failed", error?.code);
    return [];
  }

  return data.map(mapService);
}

export async function listActiveServicesForOrder(locale: string) {
  return listServices(locale, "active");
}

export async function getServiceById(locale: string, serviceId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", serviceId)
    .maybeSingle<ServiceRow>();

  if (error || !data) notFound();

  return mapService(data);
}
