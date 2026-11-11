import "server-only";

import { requirePrintAccess } from "@/features/printing/server/access";
import {
  ALBARAN_REGISTER_PAGE_SIZE,
  albaranRegisterDateRange,
  albaranRegisterSearch,
  normalizeAlbaranRegisterFilters,
  type AlbaranRegisterParams,
} from "@/features/service-albarans/register";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ServiceAlbaranRegisterRow = {
  id: string;
  order_id: string;
  document_number: string;
  document_status: "issued" | "cancelled";
  issued_at: string;
  snapshot_version: number;
  customer_name: string;
  property_name: string | null;
  location_name: string;
  order_number: string;
};

// Only historical document labels; no live customer/order joins, items or financial fields.
const REGISTER_SELECT = "id,order_id,document_number,document_status,issued_at,snapshot_version,customer_name:snapshot->customer->>name,property_name:snapshot->property->>name,location_name:snapshot->location->>name,order_number:snapshot->order->>number";

export async function listServiceAlbaranRegister(locale: string, params: AlbaranRegisterParams) {
  // Keep redirects/denials outside query error handling, including direct URL requests.
  const { membership } = await requirePrintAccess(locale);
  const filters = normalizeAlbaranRegisterFilters(params);
  const timeZone = membership.organization.timezone;
  const range = albaranRegisterDateRange(filters, timeZone);
  const base = { filters, timeZone };
  if (!range) return { ...base, state: "invalidFilters" } as const;

  try {
    const supabase = await createSupabaseServerClient();
    const readPage = (page: number) => {
      let query = supabase.from("service_albarans").select(REGISTER_SELECT, { count: "exact" })
        .eq("organization_id", membership.organization.id)
        .order("issued_at", { ascending: false }).order("id", { ascending: false });
      if (filters.status !== "all") query = query.eq("document_status", filters.status);
      if (range.from) query = query.gte("issued_at", range.from);
      if (range.until) query = query.lt("issued_at", range.until);
      if (filters.query) query = query.or(albaranRegisterSearch(filters.query));
      const offset = (page - 1) * ALBARAN_REGISTER_PAGE_SIZE;
      return query.range(offset, offset + ALBARAN_REGISTER_PAGE_SIZE - 1).returns<ServiceAlbaranRegisterRow[]>();
    };
    let page = filters.page;
    let result = await readPage(page);
    // PostgREST returns 416/PGRST103 (without count) for an offset beyond the result.
    // Read page one to obtain the filtered count, then resolve the requested final page.
    if (result.error?.code === "PGRST103" && page > 1) {
      page = 1;
      result = await readPage(page);
    }
    if (result.error || !Array.isArray(result.data) || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("albaran_register_read_failed");
    const pages = Math.max(1, Math.ceil(result.count / ALBARAN_REGISTER_PAGE_SIZE));
    const targetPage = Math.min(filters.page, pages);
    if (page !== targetPage) {
      page = targetPage;
      result = await readPage(page);
    }
    if (result.error || !Array.isArray(result.data) || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0
      || result.data.some((row) => row.snapshot_version !== 1)) throw new Error("albaran_register_read_failed");
    return { ...base, state: "ready", items: result.data, count: result.count, page, pages } as const;
  } catch {
    console.error("Service albaran register read failed");
    return { ...base, state: "unavailable" } as const;
  }
}
