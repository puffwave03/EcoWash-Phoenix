import "server-only";

import { notFound } from "next/navigation";
import type { Service } from "@/features/services/types";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EffectiveServiceRow = {
  amount: number;
  category: string | null;
  code: string | null;
  currency: string;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
  price_is_from: boolean;
  pricing_segment_name: string | null;
  pricing_source: "base" | "segment";
  unit_type: Service["unitType"];
  valid_from: string;
  valid_to: string | null;
};

export async function listEffectiveServicesForOrder(locale: string, orderId: string): Promise<Service[]> {
  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("list_effective_order_services", { target_order_id: orderId })
    .returns<EffectiveServiceRow[]>();

  if (error) {
    if (error.code === "42883") notFound();
    console.error("Effective order services failed", error.code);
    return [];
  }

  const services = (data ?? []) as EffectiveServiceRow[];

  return services.map((service) => ({
    amount: Number(service.amount),
    category: service.category,
    code: service.code,
    currency: service.currency,
    description: service.description,
    id: service.id,
    isActive: service.is_active,
    name: service.name,
    priceIsFrom: service.price_is_from,
    pricingSegmentName: service.pricing_segment_name,
    pricingSource: service.pricing_source,
    unitType: service.unit_type,
    validFrom: service.valid_from,
    validTo: service.valid_to,
  }));
}
