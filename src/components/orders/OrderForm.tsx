"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { OrderActionState, Order } from "@/features/orders/types";
import type { OrderSelectOption, PropertySelectOption } from "@/features/orders/server/queries";

type OrderFormText = {
  customer: string;
  customerNotes: string;
  dueAt: string;
  error: string;
  express: string;
  internalNotes: string;
  normal: string;
  priority: string;
  property: string;
  save: string;
  saving: string;
};

type OrderFormProps = {
  action: (state: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  customers: OrderSelectOption[];
  order?: Order;
  properties: PropertySelectOption[];
  text: OrderFormText;
};

const initialState: OrderActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

export function OrderForm({ action, customers, order, properties, text }: OrderFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.formError ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.customer}</span>
          <select className={fieldClass(Boolean(state.fieldErrors.customerId))} defaultValue={order?.customerId ?? ""} disabled={Boolean(order)} name="customerId">
            <option value="" />
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.property}</span>
          <select className={fieldClass(Boolean(state.fieldErrors.propertyId))} defaultValue={order?.propertyId ?? ""} disabled={Boolean(order)} name="propertyId">
            <option value="" />
            {properties.map((property) => <option data-customer-id={property.customerId} key={property.id} value={property.id}>{property.label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.priority}</span>
          <select className={fieldClass(false)} defaultValue={order?.priority ?? "normal"} name="priority">
            <option value="normal">{text.normal}</option>
            <option value="express">{text.express}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.dueAt}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.dueAt))} defaultValue={order?.dueAt ? order.dueAt.slice(0, 16) : ""} name="dueAt" type="datetime-local" />
        </label>
      </div>
      {order ? (
        <>
          <input name="customerId" type="hidden" value={order.customerId} />
          <input name="propertyId" type="hidden" value={order.propertyId ?? ""} />
        </>
      ) : null}
      <input name="locationId" type="hidden" value="" />
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.customerNotes}</span>
        <textarea className="min-h-24 w-full rounded-control border border-border bg-white px-3 py-3 text-sm" defaultValue={order?.customerNotes ?? ""} name="customerNotes" />
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.internalNotes}</span>
        <textarea className="min-h-24 w-full rounded-control border border-border bg-white px-3 py-3 text-sm" defaultValue={order?.internalNotes ?? ""} name="internalNotes" />
      </label>
      <Button disabled={isPending} type="submit">{isPending ? text.saving : text.save}</Button>
    </form>
  );
}
