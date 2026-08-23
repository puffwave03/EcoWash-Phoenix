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
import type {
  CustomerPortalOrderProperty,
  CustomerPortalOrderRequestState,
  CustomerPortalOrderService,
} from "@/features/portal/types";
import { formatCurrency, formatQuantity } from "@/lib/number-format";

type CustomerOrderRequestText = {
  address: string;
  addressIncomplete: string;
  back: string;
  confirm: string;
  customerNotes: string;
  customerNotesPlaceholder: string;
  estimatedTotal: string;
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
  perPiece: string;
  perWeight: string;
  pickupHelp: string;
  property: string;
  quantity: string;
  requestedPickupAt: string;
  review: string;
  reviewIntro: string;
  selectProperty: string;
  serviceSelection: string;
  submitting: string;
  unitPiece: string;
  unitWeight: string;
};

type CustomerOrderRequestFormProps = {
  action: (
    state: CustomerPortalOrderRequestState,
    formData: FormData,
  ) => Promise<CustomerPortalOrderRequestState>;
  currency: string;
  locale: string;
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
    setReviewing(false);
  }

  function validateReview() {
    const errors: Record<string, string> = {};

    if (selectedItems.length === 0) errors.items = text.errors.services;
    if (selectedItems.some(({ quantity, service }) => (
      quantity > 10000
      || Number(quantity.toFixed(3)) !== quantity
      || (service.unitType === "piece" && !Number.isInteger(quantity))
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
                    {formatQuantity(quantity, locale)} {service.unitType === "piece" ? text.unitPiece : text.unitWeight}
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

        <div className="rounded-card bg-[#09291f] p-5 text-white shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {text.estimatedTotal}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
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
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((service) => {
              const selected = service.id in quantities;

              return (
                <Card
                  className={`space-y-4 !p-4 transition-standard ${selected ? "border-primary ring-1 ring-primary" : ""}`}
                  key={service.id}
                >
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input
                      checked={selected}
                      className="mt-1 h-5 w-5 shrink-0 accent-primary"
                      onChange={(event) => toggleService(service, event.target.checked)}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-primary">{service.name}</span>
                      {service.description ? (
                        <span className="mt-1 block text-sm leading-5 text-muted">{service.description}</span>
                      ) : null}
                      <span className="mt-2 block text-sm font-semibold text-secondary">
                        {formatCurrency(service.amount, service.currency, locale)} {service.unitType === "piece" ? text.perPiece : text.perWeight}
                      </span>
                    </span>
                  </label>

                  {selected ? (
                    <label className="block space-y-2 text-sm font-semibold text-primary">
                      <span>{text.quantity}</span>
                      <input
                        className={fieldClass(Boolean(clientErrors.items))}
                        inputMode="decimal"
                        min={service.unitType === "piece" ? "1" : "0.001"}
                        onChange={(event) => {
                          setQuantities((current) => ({
                            ...current,
                            [service.id]: event.target.value,
                          }));
                          setReviewing(false);
                        }}
                        step={service.unitType === "piece" ? "1" : "0.001"}
                        type="number"
                        value={quantities[service.id]}
                      />
                    </label>
                  ) : null}
                </Card>
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

      <div className="sticky bottom-3 z-20 rounded-card border border-border bg-white/95 p-3 shadow-luxury backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="text-sm font-medium text-muted">{text.estimatedTotal}</span>
          <span className="text-lg font-semibold text-primary">
            {formatCurrency(estimatedTotal, currency, locale)}
          </span>
        </div>
        <Button
          className="w-full"
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
