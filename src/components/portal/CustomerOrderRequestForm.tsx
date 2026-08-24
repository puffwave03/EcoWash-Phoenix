"use client";

import {
  useActionState,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PortalMedia } from "@/components/portal/PortalMedia";
import {
  DEFAULT_PORTAL_MEDIA,
  portalCategoryMedia,
  type PortalMediaRegistry,
} from "@/features/portal/media";
import type {
  CustomerPortalOrderProperty,
  CustomerPortalOrderRequestState,
  CustomerPortalOrderService,
} from "@/features/portal/types";
import { catalogCategoryLabel, groupServicesByCategory } from "@/features/services/catalog";
import { isDiscreteServiceUnit, type ServiceUnitType } from "@/features/services/types";
import { formatCurrency, formatQuantity } from "@/lib/number-format";

type CustomerOrderRequestText = {
  address: string;
  addressIncomplete: string;
  add: string;
  allCategories: string;
  back: string;
  categoryFilter: string;
  collapse: string;
  confirm: string;
  customerNotes: string;
  customerNotesPlaceholder: string;
  estimatedTotal: string;
  expand: string;
  errors: {
    generic: string;
    invalidQuantity: string;
    pickupPast: string;
    property: string;
    requestedPickupAt: string;
    services: string;
  };
  noProperties: string;
  noServices: string;
  noServicesMatch: string;
  categoryLabels: Record<string, string>;
  fromPrice: string;
  pickupHelp: string;
  property: string;
  quantity: string;
  requestedPickupAt: string;
  review: string;
  reviewIntro: string;
  remove: string;
  search: string;
  searchPlaceholder: string;
  selectProperty: string;
  serviceSelection: string;
  servicesCount: string;
  servicesSelected: string;
  submitting: string;
  unitTypes: Record<ServiceUnitType, string>;
};

type CustomerOrderRequestFormProps = {
  action: (
    state: CustomerPortalOrderRequestState,
    formData: FormData,
  ) => Promise<CustomerPortalOrderRequestState>;
  currency: string;
  locale: string;
  media?: PortalMediaRegistry;
  minimumPickupAt: string;
  properties: CustomerPortalOrderProperty[];
  requestId: string;
  services: CustomerPortalOrderService[];
  text: CustomerOrderRequestText;
  timeZone: string;
};

const initialState: CustomerPortalOrderRequestState = {
  fieldErrors: {},
  formError: null,
};

function fieldClass(hasError = false) {
  return `min-h-12 w-full rounded-control border bg-white px-4 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function propertyAddress(property: CustomerPortalOrderProperty | undefined) {
  if (!property) return "";

  return [
    property.addressLine1,
    property.addressLine2,
    property.city,
    property.postalCode,
    property.countryCode,
  ].filter(Boolean).join(", ");
}

function completeProperty(property: CustomerPortalOrderProperty | undefined) {
  return Boolean(property?.addressLine1 && property.city && property.countryCode);
}

export function CustomerOrderRequestForm({
  action,
  currency,
  locale,
  media = DEFAULT_PORTAL_MEDIA,
  minimumPickupAt,
  properties,
  requestId,
  services,
  text,
  timeZone,
}: CustomerOrderRequestFormProps) {
  const actionInFlightRef = useRef(false);
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [propertyId, setPropertyId] = useState("");
  const [requestedPickupAt, setRequestedPickupAt] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categoryGroups = useMemo(() => groupServicesByCategory(services), [services]);
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(categoryGroups.slice(0, 1).map((group) => group.category)),
  );
  const [state, formAction, isPending] = useActionState(guardedAction, initialState);
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const selectedItems = useMemo(
    () => services.flatMap((service) => {
      const quantity = Number(quantities[service.id]);

      return Number.isFinite(quantity) && quantity > 0
        ? [{ quantity, service }]
        : [];
    }),
    [quantities, services],
  );
  const estimatedTotal = selectedItems.reduce(
    (total, item) => total + Math.round(item.quantity * item.service.amount * 100) / 100,
    0,
  );
  const isLocked = isPending || isSubmitLocked;
  const visibleCategoryGroups = useMemo(() => {
    const query = serviceSearch.trim().toLocaleLowerCase(locale);
    const filtered = services.filter((service) => (
      (categoryFilter === "all" || service.category === categoryFilter)
      && (!query || [
        service.name,
        service.category,
        catalogCategoryLabel(service.category?.trim() || "other", text.categoryLabels),
      ].some((value) => value?.toLocaleLowerCase(locale).includes(query)))
    ));

    return groupServicesByCategory(filtered);
  }, [categoryFilter, locale, serviceSearch, services, text.categoryLabels]);

  async function guardedAction(
    currentState: CustomerPortalOrderRequestState,
    formData: FormData,
  ) {
    try {
      return await action(currentState, formData);
    } finally {
      actionInFlightRef.current = false;
      setIsSubmitLocked(false);
    }
  }

  function toggleService(service: CustomerPortalOrderService, selected: boolean) {
    setQuantities((current) => {
      const next = { ...current };

      if (selected) next[service.id] = "1";
      else delete next[service.id];

      return next;
    });
    if (selected && service.category) {
      setOpenCategories((current) => new Set(current).add(service.category as string));
    }
    setReviewing(false);
  }

  function toggleCategory(category: string) {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function changeQuantity(service: CustomerPortalOrderService, direction: -1 | 1) {
    const step = isDiscreteServiceUnit(service.unitType) ? 1 : 0.1;
    const current = Number(quantities[service.id]) || step;
    const next = Math.max(step, Math.round((current + direction * step) * 1000) / 1000);
    setQuantities((values) => ({ ...values, [service.id]: String(next) }));
    setReviewing(false);
  }

  function validateReview() {
    const errors: Record<string, string> = {};

    if (selectedItems.length === 0) errors.items = text.errors.services;
    if (selectedItems.some(({ quantity, service }) => (
      quantity > 10000
      || Number(quantity.toFixed(3)) !== quantity
      || (isDiscreteServiceUnit(service.unitType) && !Number.isInteger(quantity))
    ))) {
      errors.items = text.errors.invalidQuantity;
    }
    if (!selectedProperty) errors.propertyId = text.errors.property;
    else if (!completeProperty(selectedProperty)) errors.propertyId = text.addressIncomplete;
    if (!requestedPickupAt) errors.requestedPickupAt = text.errors.requestedPickupAt;
    else if (requestedPickupAt <= minimumPickupAt) {
      errors.requestedPickupAt = text.errors.pickupPast;
    }

    setClientErrors(errors);

    if (Object.keys(errors).length === 0) {
      setReviewing(true);
      window.scrollTo({ behavior: "smooth", top: 0 });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (actionInFlightRef.current || isPending) {
      event.preventDefault();
      return;
    }

    actionInFlightRef.current = true;
    setIsSubmitLocked(true);
  }

  const serverError = state.formError ? text.errors[state.formError] : null;
  const serverValidationError = Object.keys(state.fieldErrors).length > 0
    ? text.errors.generic
    : null;

  if (reviewing) {
    return (
      <form action={formAction} className="space-y-5" onSubmit={handleSubmit}>
        <input name="requestId" type="hidden" value={requestId} />
        <input name="propertyId" type="hidden" value={propertyId} />
        <input name="requestedPickupAt" type="hidden" value={requestedPickupAt} />
        <input
          name="items"
          type="hidden"
          value={JSON.stringify(selectedItems.map(({ quantity, service }) => ({
            quantity,
            serviceId: service.id,
          })))}
        />
        <input name="customerNotes" type="hidden" value={customerNotes} />

        <div>
          <h2 className="text-2xl font-semibold text-primary">{text.review}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{text.reviewIntro}</p>
        </div>

        {serverError || serverValidationError ? (
          <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {serverError ?? serverValidationError}
          </p>
        ) : null}

        <Card className="space-y-4 !p-4 sm:!p-5">
          <h3 className="text-lg font-semibold text-primary">{text.serviceSelection}</h3>
          <div className="space-y-3">
            {selectedItems.map(({ quantity, service }) => (
              <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0" key={service.id}>
                <div>
                  <p className="font-semibold text-primary">{service.name}</p>
                  <p className="text-sm text-muted">
                    {formatQuantity(quantity, locale)} {text.unitTypes[service.unitType]}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-primary">
                  {formatCurrency(quantity * service.amount, currency, locale)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 !p-4 sm:!p-5">
          <h3 className="text-lg font-semibold text-primary">{text.property}</h3>
          <p className="font-semibold text-primary">{selectedProperty?.name}</p>
          <p className="text-sm leading-6 text-muted">{propertyAddress(selectedProperty)}</p>
          <div className="border-t border-border pt-3">
            <p className="text-sm text-muted">{text.requestedPickupAt}</p>
            <p className="mt-1 font-semibold text-primary">
              {new Date(`${requestedPickupAt}:00Z`).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              })}
            </p>
            <p className="mt-1 text-xs text-muted">{timeZone}</p>
          </div>
        </Card>

        <div className="rounded-card border border-primary/15 bg-primary-soft/65 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {text.estimatedTotal}
          </p>
          <p className="mt-2 text-3xl font-semibold text-primary">
            {formatCurrency(estimatedTotal, currency, locale)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            className="w-full"
            disabled={isLocked}
            onClick={() => setReviewing(false)}
            type="button"
            variant="secondary"
          >
            {text.back}
          </Button>
          <Button className="w-full" disabled={isLocked} type="submit">
            {isLocked ? text.submitting : text.confirm}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="portal-request-services">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">1</p>
          <h2 className="text-2xl font-semibold text-primary" id="portal-request-services">
            {text.serviceSelection}
          </h2>
        </div>

        {services.length === 0 ? (
          <p className="rounded-card border border-border bg-white p-4 text-sm text-muted">
            {text.noServices}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="sticky top-[4.5rem] z-20 -mx-1 rounded-card border border-border bg-white/95 p-3 shadow-card backdrop-blur sm:top-[5.5rem] sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)]">
                <label className="space-y-1.5 text-sm font-semibold text-primary">
                  <span>{text.search}</span>
                  <div className="relative">
                    <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>
                    <input className={`${fieldClass()} pl-11`} onChange={(event) => setServiceSearch(event.target.value)} placeholder={text.searchPlaceholder} type="search" value={serviceSearch} />
                  </div>
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-primary">
                  <span>{text.categoryFilter}</span>
                  <select className={fieldClass()} onChange={(event) => {
                    const category = event.target.value;
                    setCategoryFilter(category);
                    if (category !== "all") setOpenCategories((current) => new Set(current).add(category));
                  }} value={categoryFilter}>
                    <option value="all">{text.allCategories}</option>
                    {categoryGroups.map(({ category }) => <option key={category} value={category}>{catalogCategoryLabel(category, text.categoryLabels)}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {visibleCategoryGroups.length === 0 ? (
              <p className="rounded-card border border-dashed border-border bg-white p-6 text-center text-sm text-muted">{text.noServicesMatch}</p>
            ) : visibleCategoryGroups.map(({ category, items }) => {
              const searchActive = Boolean(serviceSearch.trim());
              const isOpen = searchActive || openCategories.has(category);
              const lowestPrice = items.reduce((lowest, service) => service.amount < lowest.amount ? service : lowest);
              const categoryMedia = portalCategoryMedia(category, media);
              const fallbackImagePath = items.find((service) => service.portalImagePath)?.portalImagePath ?? null;
              const selectedInCategory = items.filter((service) => service.id in quantities).length;

              return (
                <section className="scroll-mt-44 overflow-hidden rounded-card border border-border bg-white shadow-card" id={`category-${category}`} key={category}>
                  <button
                    aria-expanded={isOpen}
                    className="group flex min-h-20 w-full items-center gap-3 p-3 text-left transition-standard hover:bg-primary-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-4 sm:p-4"
                    onClick={() => toggleCategory(category)}
                    type="button"
                  >
                    <PortalMedia
                      alt=""
                      className="h-14 w-16 shrink-0 rounded-control sm:h-16 sm:w-24"
                      imageClassName="transition-transform duration-300 group-hover:scale-105"
                      objectPosition={categoryMedia?.objectPosition}
                      sizes="(max-width: 639px) 64px, 96px"
                      src={categoryMedia?.path ?? fallbackImagePath}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-foreground sm:text-lg">{catalogCategoryLabel(category, text.categoryLabels)}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:text-sm">
                        <span>{items.length} {text.servicesCount}</span>
                        <span>{items.length > 1 || lowestPrice.priceIsFrom ? `${text.fromPrice} ` : ""}{formatCurrency(lowestPrice.amount, lowestPrice.currency, locale)} / {text.unitTypes[lowestPrice.unitType]}</span>
                        {selectedInCategory > 0 ? <strong className="text-primary">{text.servicesSelected.replace("{count}", String(selectedInCategory))}</strong> : null}
                      </span>
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-primary" aria-label={isOpen ? text.collapse : text.expand}>
                      <svg aria-hidden="true" className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="grid gap-3 border-t border-border bg-[#f8faf8] p-3 sm:p-4 md:grid-cols-2">
                      {items.map((service) => {
                        const selected = service.id in quantities;
                        return (
                          <article className={`rounded-card border bg-white p-4 transition-standard ${selected ? "border-primary shadow-card ring-1 ring-primary/15" : "border-border"}`} key={service.id}>
                            <div className="flex min-h-24 flex-col">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="font-semibold leading-5 text-foreground">{service.name}</h4>
                                  {service.description ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{service.description}</p> : null}
                                </div>
                                <button
                                  aria-pressed={selected}
                                  className={`inline-flex min-h-10 shrink-0 items-center rounded-control border px-3 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-primary !text-white" : "border-primary/25 bg-primary-soft !text-primary hover:border-primary"}`}
                                  onClick={() => toggleService(service, !selected)}
                                  type="button"
                                >
                                  {selected ? text.remove : text.add}
                                </button>
                              </div>
                              <p className="mt-auto pt-4 text-lg font-semibold text-primary">
                                {service.priceIsFrom ? `${text.fromPrice} ` : ""}{formatCurrency(service.amount, service.currency, locale)} <span className="text-sm font-medium text-muted">/ {text.unitTypes[service.unitType]}</span>
                              </p>
                            </div>

                            {selected ? (
                              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                                <span className="text-sm font-semibold text-primary">{text.quantity}</span>
                                <div className="grid grid-cols-[2.75rem_minmax(4.5rem,6rem)_2.75rem] items-center overflow-hidden rounded-control border border-border bg-white">
                                  <button className="min-h-11 text-xl font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => changeQuantity(service, -1)} type="button" aria-label={`− ${text.quantity}`}>−</button>
                                  <input
                                    aria-label={text.quantity}
                                    className="min-h-11 w-full border-x border-border px-1 text-center text-base font-semibold outline-none focus:bg-primary-soft/50"
                                    inputMode="decimal"
                                    min={isDiscreteServiceUnit(service.unitType) ? "1" : "0.001"}
                                    onChange={(event) => {
                                      setQuantities((current) => ({ ...current, [service.id]: event.target.value }));
                                      setReviewing(false);
                                    }}
                                    step={isDiscreteServiceUnit(service.unitType) ? "1" : "0.001"}
                                    type="number"
                                    value={quantities[service.id]}
                                  />
                                  <button className="min-h-11 text-xl font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => changeQuantity(service, 1)} type="button" aria-label={`+ ${text.quantity}`}>+</button>
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
        {clientErrors.items ? <p className="text-sm text-red-700" role="alert">{clientErrors.items}</p> : null}
      </section>

      <section className="space-y-4" aria-labelledby="portal-request-property">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">2</p>
          <h2 className="text-2xl font-semibold text-primary" id="portal-request-property">
            {text.property}
          </h2>
        </div>
        {properties.length === 0 ? (
          <p className="rounded-card border border-border bg-white p-4 text-sm text-muted">
            {text.noProperties}
          </p>
        ) : (
          <Card className="space-y-4 !p-4 sm:!p-5">
            <label className="block space-y-2 text-sm font-semibold text-primary">
              <span>{text.selectProperty}</span>
              <select
                className={fieldClass(Boolean(clientErrors.propertyId))}
                onChange={(event) => {
                  setPropertyId(event.target.value);
                  setReviewing(false);
                }}
                value={propertyId}
              >
                <option value="">{text.selectProperty}</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </label>
            {selectedProperty ? (
              <div className="rounded-control bg-primary-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">{text.address}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-primary">
                  {propertyAddress(selectedProperty) || text.addressIncomplete}
                </p>
              </div>
            ) : null}
          </Card>
        )}
        {clientErrors.propertyId ? <p className="text-sm text-red-700" role="alert">{clientErrors.propertyId}</p> : null}
      </section>

      <section className="space-y-4" aria-labelledby="portal-request-pickup">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">3</p>
          <h2 className="text-2xl font-semibold text-primary" id="portal-request-pickup">
            {text.requestedPickupAt}
          </h2>
        </div>
        <Card className="space-y-4 !p-4 sm:!p-5">
          <label className="block space-y-2 text-sm font-semibold text-primary">
            <span>{text.requestedPickupAt}</span>
            <input
              className={fieldClass(Boolean(clientErrors.requestedPickupAt))}
              min={minimumPickupAt}
              onChange={(event) => {
                setRequestedPickupAt(event.target.value);
                setReviewing(false);
              }}
              type="datetime-local"
              value={requestedPickupAt}
            />
          </label>
          <p className="text-sm leading-6 text-muted">{text.pickupHelp} · {timeZone}</p>
          <label className="block space-y-2 text-sm font-semibold text-primary">
            <span>{text.customerNotes}</span>
            <textarea
              className="min-h-24 w-full rounded-control border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
              maxLength={1000}
              onChange={(event) => {
                setCustomerNotes(event.target.value);
                setReviewing(false);
              }}
              placeholder={text.customerNotesPlaceholder}
              value={customerNotes}
            />
          </label>
        </Card>
        {clientErrors.requestedPickupAt ? <p className="text-sm text-red-700" role="alert">{clientErrors.requestedPickupAt}</p> : null}
      </section>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 rounded-card border border-primary/15 bg-white/96 p-3 shadow-luxury backdrop-blur lg:bottom-3 lg:flex lg:items-center lg:gap-5 lg:p-4">
        <div className="mb-3 flex flex-1 items-center justify-between gap-4 px-1 lg:mb-0">
          <span className="text-sm font-medium text-muted"><strong className="block text-primary">{text.servicesSelected.replace("{count}", String(selectedItems.length))}</strong>{text.estimatedTotal}</span>
          <span className="text-2xl font-semibold tracking-tight text-primary">
            {formatCurrency(estimatedTotal, currency, locale)}
          </span>
        </div>
        <Button
          className="w-full lg:w-auto lg:min-w-56"
          disabled={services.length === 0 || properties.length === 0}
          onClick={validateReview}
          type="button"
        >
          {text.review}
        </Button>
      </div>
    </div>
  );
}
