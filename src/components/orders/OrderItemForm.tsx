"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { OrderActionState, OrderItem } from "@/features/orders/types";
import type { Service } from "@/features/services/types";

type OrderItemFormText = {
  addItem: string;
  cancel?: string;
  description: string;
  error: string;
  notes: string;
  piece: string;
  quantity: string;
  saving: string;
  service: string;
  unitPrice: string;
  unitType: string;
  weight: string;
};

type OrderItemFormProps = {
  action: (state: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  item?: OrderItem;
  onCancel?: () => void;
  onSuccess?: () => void;
  services: Service[];
  text: OrderItemFormText;
};

const initialState: OrderActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function hasErrors(state: OrderActionState) {
  return Boolean(state.formError) || Object.keys(state.fieldErrors).length > 0;
}

export function OrderItemForm({ action, item, onCancel, onSuccess, services, text }: OrderItemFormProps) {
  const submittedRef = useRef(false);
  const actionInFlightRef = useRef(false);
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const [state, formAction, isPending] = useActionState(guardedAction, initialState);
  const [selectedServiceId, setSelectedServiceId] = useState(item?.serviceId ?? "");
  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [selectedServiceId, services],
  );
  const isLocked = isPending || isSubmitLocked;

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
    <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_1fr_8rem_8rem_8rem_auto] md:items-end" onSubmit={handleSubmit}>
      <input name="itemId" type="hidden" value={item?.id ?? ""} />
      {state.formError ? <p className="md:col-span-6 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.service}</span>
        <select
          className={fieldClass(false)}
          disabled={isLocked}
          name="serviceId"
          onChange={(event) => setSelectedServiceId(event.target.value)}
          value={selectedServiceId}
        >
          <option value="" />
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.description}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.description))} defaultValue={item?.description ?? selectedService?.name ?? ""} disabled={isLocked} key={`description-${selectedServiceId}`} name="description" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.unitType}</span>
        <select className={fieldClass(Boolean(state.fieldErrors.unitType))} defaultValue={item?.unitType ?? selectedService?.unitType ?? "piece"} disabled={isLocked} key={`unit-${selectedServiceId}`} name="unitType">
          <option value="piece">{text.piece}</option>
          <option value="weight">{text.weight}</option>
        </select>
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.quantity}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.quantity))} defaultValue={item?.quantity ?? "1"} disabled={isLocked} min="0.001" name="quantity" step="0.001" type="number" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.unitPrice}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.unitPrice))} defaultValue={item?.unitPrice ?? selectedService?.amount ?? "0"} disabled={isLocked} key={`price-${selectedServiceId}`} min="0" name="unitPrice" step="0.01" type="number" />
      </label>
      <input name="notes" type="hidden" value={item?.notes ?? ""} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={isLocked} type="submit">{isLocked ? text.saving : text.addItem}</Button>
        {onCancel ? (
          <Button disabled={isLocked} onClick={onCancel} type="button" variant="secondary">
            {text.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
