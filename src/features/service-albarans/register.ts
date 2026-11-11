import { organizationDateTimeLocalToIso } from "@/lib/organization-timezone";

export const ALBARAN_REGISTER_PAGE_SIZE = 25;
export type AlbaranRegisterParams = Record<string, string | string[] | undefined>;
export type AlbaranRegisterFilters = {
  query: string;
  status: "all" | "issued" | "cancelled";
  from: string;
  to: string;
  page: number;
};

const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export function normalizeAlbaranRegisterFilters(params: AlbaranRegisterParams): AlbaranRegisterFilters {
  const page = scalar(params.page);
  const status = scalar(params.status);
  return {
    query: scalar(params.q).trim().slice(0, 120),
    status: status === "issued" || status === "cancelled" ? status : "all",
    from: scalar(params.from).slice(0, 32),
    to: scalar(params.to).slice(0, 32),
    page: /^[1-9]\d{0,7}$/.test(page) ? Number(page) : 1,
  };
}

function validDay(value: string) {
  return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function albaranRegisterDateRange(filters: AlbaranRegisterFilters, timeZone: string) {
  if ((filters.from && !validDay(filters.from)) || (filters.to && !validDay(filters.to))
    || (filters.from && filters.to && filters.from > filters.to)) return null;
  const from = filters.from ? organizationDateTimeLocalToIso(`${filters.from}T00:00`, timeZone) : null;
  const nextDay = filters.to
    ? new Date(Date.parse(`${filters.to}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    : null;
  const until = nextDay ? organizationDateTimeLocalToIso(`${nextDay}T00:00`, timeZone) : null;
  if ((filters.from && !from) || (filters.to && !until)) return null;
  return { from, until };
}

export function albaranRegisterSearch(query: string) {
  // Quote the entire PostgREST value so commas/parentheses cannot change the filter grammar.
  const pattern = `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const quoted = `"${pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  return ["document_number", "snapshot->customer->>name", "snapshot->order->>number"]
    .map((field) => `${field}.ilike.${quoted}`).join(",");
}

export function albaranRegisterHref(filters: AlbaranRegisterFilters, page = 1) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  return `/app/albarans${params.size ? `?${params}` : ""}`;
}
