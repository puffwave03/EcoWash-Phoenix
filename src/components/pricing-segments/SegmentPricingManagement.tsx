"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import type { CatalogAdminService } from "@/features/catalog-admin/types";
import type { CatalogSegment } from "@/features/catalog-segments/types";
import type {
  SegmentPrice,
  SegmentPriceActionState,
  SegmentPriceLocation,
} from "@/features/pricing-segments/types";
import { formatCurrency, formatNumberInput } from "@/lib/number-format";

export type SegmentPricingText = {
  active: string;
  add: string;
  allLocations: string;
  amount: string;
  basePrice: string;
  description: string;
  empty: string;
  effective: string;
  error: string;
  inactive: string;
  location: string;
  noBasePrice: string;
  noSegments: string;
  overridePrice: string;
  fallback: string;
  overlap: string;
  save: string;
  saved: string;
  saving: string;
  segment: string;
  search: string;
  searchPlaceholder: string;
  title: string;
  validFrom: string;
  validTo: string;
};

type Action = (state: SegmentPriceActionState, formData: FormData) => Promise<SegmentPriceActionState>;
const initialState: SegmentPriceActionState = { fieldErrors: {}, formError: null, success: false };

function inputClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${hasError ? "border-red-300" : "border-border"}`;
}

function PriceForm({
  action,
  currency,
  location,
  locations,
  price,
  segmentId,
  serviceId,
  text,
  today,
}: {
  action: Action;
  currency: string;
  location?: string | null;
  locations: SegmentPriceLocation[];
  price?: SegmentPrice;
  segmentId: string;
  serviceId: string;
  text: SegmentPricingText;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="rounded-card border border-border bg-surface-subtle p-4">
      <input name="priceId" type="hidden" value={price?.id ?? ""} />
      <input name="segmentId" type="hidden" value={segmentId} />
      <input name="serviceId" type="hidden" value={serviceId} />
      <input name="currency" type="hidden" value={price?.currency ?? currency} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-xs font-semibold text-primary">
          <span>{text.amount}</span>
          <input className={inputClass(Boolean(state.fieldErrors.amount))} defaultValue={formatNumberInput(price?.amount ?? 0, 2)} min="0" name="amount" required step="0.01" type="number" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-primary">
          <span>{text.location}</span>
          <select className={inputClass(Boolean(state.fieldErrors.locationId))} defaultValue={price?.locationId ?? location ?? ""} disabled={Boolean(price)} name="locationId">
            <option value="">{text.allLocations}</option>
            {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {price ? <input name="locationId" type="hidden" value={price.locationId ?? ""} /> : null}
        </label>
        <label className="space-y-1 text-xs font-semibold text-primary">
          <span>{text.validFrom}</span>
          <input className={inputClass(Boolean(state.fieldErrors.validFrom))} defaultValue={price?.validFrom ?? today} name="validFrom" required type="date" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-primary">
          <span>{text.validTo}</span>
          <input className={inputClass(Boolean(state.fieldErrors.validTo))} defaultValue={price?.validTo ?? ""} name="validTo" type="date" />
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="inline-flex min-h-6 items-center gap-2 text-xs font-semibold text-primary">
            <input defaultChecked={price?.isActive ?? true} name="isActive" type="checkbox" />
            {text.active}
          </label>
          <Button disabled={pending} type="submit">{pending ? text.saving : text.save}</Button>
        </div>
      </div>
      {state.success ? <p className="mt-3 text-sm font-semibold text-emerald-700" role="status">{text.saved}</p> : null}
      {state.formError ? <p className="mt-3 text-sm text-red-700" role="alert">{state.formError === "overlap" ? text.overlap : text.error}</p> : null}
    </form>
  );
}

export function SegmentPricingManagement({
  action,
  currency,
  locale,
  locations,
  prices,
  segments,
  services,
  text,
  today,
}: {
  action: Action;
  currency: string;
  locale: string;
  locations: SegmentPriceLocation[];
  prices: SegmentPrice[];
  segments: CatalogSegment[];
  services: CatalogAdminService[];
  text: SegmentPricingText;
  today: string;
}) {
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const segment = segments.find((item) => item.id === segmentId) ?? null;
  const relevantServices = useMemo(() => {
    if (!segment) return [];
    const linkedServiceIds = new Set(segment.serviceLinks.map((link) => link.serviceId));
    const linkedCategories = new Set(segment.categoryLinks.map((link) => link.categoryKey));
    const pricedServiceIds = new Set(prices.filter((price) => price.segmentId === segment.id).map((price) => price.serviceId));
    const hasLinks = linkedServiceIds.size > 0 || linkedCategories.size > 0;
    const query = search.trim().toLocaleLowerCase(locale);
    return services.filter((service) => service.isActive && (
      !hasLinks
      || linkedServiceIds.has(service.id)
      || (service.portalCategoryKey && linkedCategories.has(service.portalCategoryKey))
      || pricedServiceIds.has(service.id)
    ) && (!query || [service.name, service.code, service.internalCategory].some((value) => value?.toLocaleLowerCase(locale).includes(query))));
  }, [locale, prices, search, segment, services]);

  return (
    <section className="space-y-5 rounded-card border border-border bg-white p-5 shadow-card lg:p-6">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{text.overridePrice}</p>
        <h2 className="text-2xl font-semibold text-primary">{text.title}</h2>
        <p className="text-sm leading-6 text-muted">{text.description}</p>
      </div>

      {segments.length === 0 ? (
        <p className="rounded-control border border-dashed border-border bg-surface-subtle p-4 text-sm text-muted">{text.noSegments}</p>
      ) : (
        <>
          <label className="block max-w-md space-y-2 text-sm font-semibold text-primary">
            <span>{text.segment}</span>
            <select className={inputClass()} onChange={(event) => setSegmentId(event.target.value)} value={segmentId}>
              {segments.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : ` · ${text.inactive}`}</option>)}
            </select>
          </label>
          <label className="block max-w-md space-y-2 text-sm font-semibold text-primary">
            <span>{text.search}</span>
            <input className={inputClass()} onChange={(event) => setSearch(event.target.value)} placeholder={text.searchPlaceholder} type="search" value={search} />
          </label>

          <div className="space-y-4">
            {relevantServices.length === 0 ? <p className="text-sm text-muted">{text.empty}</p> : relevantServices.map((service) => {
              const servicePrices = prices.filter((price) => price.segmentId === segmentId && price.serviceId === service.id);
              const effectivePrice = servicePrices.find((price) => price.isActive && price.validFrom <= today && (!price.validTo || price.validTo >= today));
              return (
                <article className="space-y-3 rounded-card border border-border p-4" key={service.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-primary">{service.name}</h3>
                      <p className="text-xs text-muted">{service.code ?? service.internalCategory ?? ""}</p>
                    </div>
                    <div className="rounded-control bg-primary/5 px-3 py-2 text-sm text-primary">
                      <span className="text-xs font-semibold uppercase text-muted">{text.basePrice}</span>{" "}
                      <strong>{service.amount === null ? text.noBasePrice : formatCurrency(service.amount, service.currency ?? currency, locale)}</strong>
                      <span className="ml-2 border-l border-border pl-2 text-xs font-semibold text-secondary">{text.effective}: {effectivePrice ? formatCurrency(effectivePrice.amount, effectivePrice.currency, locale) : text.fallback}</span>
                    </div>
                  </div>
                  {servicePrices.map((price) => (
                    <PriceForm action={action} currency={currency} key={price.id} locations={locations} price={price} segmentId={segmentId} serviceId={service.id} text={text} today={today} />
                  ))}
                  {service.amount !== null ? (
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-semibold text-primary">+ {text.add}</summary>
                      <div className="mt-3">
                        <PriceForm action={action} currency={service.currency ?? currency} locations={locations} segmentId={segmentId} serviceId={service.id} text={text} today={today} />
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
