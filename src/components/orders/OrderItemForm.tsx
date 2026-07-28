"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { OrderActionState, OrderItem } from "@/features/orders/types";
import type { Service } from "@/features/services/types";

type OrderItemFormText = {
  addItem: string;
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
  services: Service[];
  text: OrderItemFormText;
};

const initialState: OrderActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

export function OrderItemForm({ action, item, services, text }: OrderItemFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selectedServiceId, setSelectedServiceId] = useState(item?.serviceId ?? "");
  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [selectedServiceId, services],
  );

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_1fr_8rem_8rem_8rem_auto] md:items-end">
      <input name="itemId" type="hidden" value={item?.id ?? ""} />
      {state.formError ? <p className="md:col-span-6 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.service}</span>
        <select
          className={fieldClass(false)}
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
        <input className={fieldClass(Boolean(state.fieldErrors.description))} defaultValue={item?.description ?? selectedService?.name ?? ""} key={`description-${selectedServiceId}`} name="description" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.unitType}</span>
        <select className={fieldClass(Boolean(state.fieldErrors.unitType))} defaultValue={item?.unitType ?? selectedService?.unitType ?? "piece"} key={`unit-${selectedServiceId}`} name="unitType">
          <option value="piece">{text.piece}</option>
          <option value="weight">{text.weight}</option>
        </select>
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.quantity}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.quantity))} defaultValue={item?.quantity ?? "1"} min="0.001" name="quantity" step="0.001" type="number" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.unitPrice}</span>
        <input className={fieldClass(Boolean(state.fieldErrors.unitPrice))} defaultValue={item?.unitPrice ?? selectedService?.amount ?? "0"} key={`price-${selectedServiceId}`} min="0" name="unitPrice" step="0.01" type="number" />
      </label>
      <input name="notes" type="hidden" value={item?.notes ?? ""} />
      <Button disabled={isPending} type="submit">{isPending ? text.saving : text.addItem}</Button>
    </form>
  );
}
