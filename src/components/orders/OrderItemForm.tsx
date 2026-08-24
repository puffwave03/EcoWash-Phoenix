"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { OrderActionState, OrderItem } from "@/features/orders/types";
import type { Service } from "@/features/services/types";
import { isDiscreteServiceUnit } from "@/features/services/types";
import { catalogCategoryLabel, groupServicesByCategory } from "@/features/services/catalog";
import { formatCurrency } from "@/lib/number-format";
import { formatNumberInput } from "@/lib/number-format";

type OrderItemFormText = {
  addItem: string;
  cancel?: string;
  description: string;
  error: string;
  notes: string;
  categoryLabels: Record<string, string>;
  quantity: string;
  saving: string;
  search: string;
  searchPlaceholder: string;
  service: string;
  unitPrice: string;
  unitType: string;
  unitTypes: Record<Service["unitType"], string>;
};

type OrderItemFormProps = {
  action: (state: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  item?: OrderItem;
  locale: string;
  onCancel?: () => void;
  onSuccess?: () => void;
  services: Service[];
  text: OrderItemFormText;
};

const initialState: OrderActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-12 w-full rounded-control border bg-white px-3.5 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function hasErrors(state: OrderActionState) {
  return Boolean(state.formError) || Object.keys(state.fieldErrors).length > 0;
}

export function OrderItemForm({ action, item, locale, onCancel, onSuccess, services, text }: OrderItemFormProps) {
  const submittedRef = useRef(false);
  const actionInFlightRef = useRef(false);
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const [state, formAction, isPending] = useActionState(guardedAction, initialState);
  const [selectedServiceId, setSelectedServiceId] = useState(item?.serviceId ?? "");
  const [serviceSearch, setServiceSearch] = useState("");
  const [unitType, setUnitType] = useState(
    item?.unitType
      ?? services.find((service) => service.id === item?.serviceId)?.unitType
      ?? "piece",
  );
  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [selectedServiceId, services],
  );
  const isLocked = isPending || isSubmitLocked;
  const visibleServices = useMemo(() => {
    const query = serviceSearch.trim().toLocaleLowerCase(locale);
    return !query ? services : services.filter((service) => (
      service.id === selectedServiceId
      || [service.name, service.code, service.category].some((value) => value?.toLocaleLowerCase(locale).includes(query))
    ));
  }, [locale, selectedServiceId, serviceSearch, services]);

  async function guardedAction(currentState: OrderActionState, formData: FormData) {
    if (actionInFlightRef.current) return currentState;

    submittedRef.current = true;
    actionInFlightRef.current = true;
    setIsSubmitLocked(true);
    const nextState = await action(currentState, formData);

    submittedRef.current = false;
    actionInFlightRef.current = false;
    setIsSubmitLocked(false);

    if (!hasErrors(nextState)) onSuccess?.();

    return nextState;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittedRef.current) {
      event.preventDefault();
      return;
    }

    submittedRef.current = true;
    setIsSubmitLocked(true);
  }

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_8rem_8rem_8rem_auto] xl:items-end" onSubmit={handleSubmit}>
      <input name="itemId" type="hidden" value={item?.id ?? ""} />
      {state.formError ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2 xl:col-span-6">{text.error}</p> : null}
      <label className="space-y-2 text-sm font-semibold text-primary md:col-span-2 xl:col-span-6">
        <span>{text.search}</span>
        <input className={fieldClass(false)} disabled={isLocked} onChange={(event) => setServiceSearch(event.target.value)} placeholder={text.searchPlaceholder} type="search" value={serviceSearch} />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.service}</span>
        <select
          className={fieldClass(false)}
          disabled={isLocked}
          name="serviceId"
          onChange={(event) => {
            const serviceId = event.target.value;
            setSelectedServiceId(serviceId);
            setUnitType(services.find((service) => service.id === serviceId)?.unitType ?? "piece");
          }}
          value={selectedServiceId}
        >
          <option value="" />
          {groupServicesByCategory(visibleServices).map(({ category, items }) => (
            <optgroup key={category} label={catalogCategoryLabel(category, text.categoryLabels)}>
              {items.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.priceIsFrom ? "≥ " : ""}{formatCurrency(service.amount ?? 0, service.currency ?? "EUR", locale)} / {text.unitTypes[service.unitType]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.description}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.description))} defaultValue={item?.description ?? selectedService?.name ?? ""} disabled={isLocked} key={`description-${selectedServiceId}`} name="description" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.unitType}</span>
        <select className={fieldClass(Boolean(state.fieldErrors.unitType))} disabled={isLocked} name="unitType" onChange={(event) => setUnitType(event.target.value as Service["unitType"])} value={unitType}>
          {Object.entries(text.unitTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.quantity}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.quantity))} defaultValue={formatNumberInput(item?.quantity ?? 1, 3)} disabled={isLocked} min={isDiscreteServiceUnit(unitType) ? "1" : "0.001"} name="quantity" step={isDiscreteServiceUnit(unitType) ? "1" : "0.001"} type="number" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.unitPrice}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.unitPrice))} defaultValue={formatNumberInput(item?.unitPrice ?? selectedService?.amount ?? 0, 2)} disabled={isLocked} key={`price-${selectedServiceId}`} min="0" name="unitPrice" step="0.01" type="number" />
      </label>
      <input name="notes" type="hidden" value={item?.notes ?? ""} />
      <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-1">
        <Button className="w-full sm:w-auto" disabled={isLocked} type="submit">{isLocked ? text.saving : text.addItem}</Button>
        {onCancel ? (
          <Button disabled={isLocked} onClick={onCancel} type="button" variant="secondary">
            {text.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
