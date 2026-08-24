"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { OrderItemForm } from "@/components/orders/OrderItemForm";
import type { Order, OrderActionState, OrderItem } from "@/features/orders/types";
import type { Service } from "@/features/services/types";
import { formatCurrency, formatQuantity } from "@/lib/number-format";

type OrderItemsText = {
  cancel: string;
  description: string;
  edit: string;
  error: string;
  lineTotal: string;
  categoryLabels: Record<string, string>;
  quantity: string;
  remove: string;
  removing: string;
  saveEdit: string;
  saving: string;
  search: string;
  searchPlaceholder: string;
  service: string;
  subtotal: string;
  total: string;
  unitPrice: string;
  unitType: string;
  unitTypes: Record<Service["unitType"], string>;
};

export function OrderItems({
  items,
  locale,
  onRemove,
  onSave,
  order,
  services,
  text,
}: {
  items: OrderItem[];
  locale: string;
  onRemove: (itemId: string) => Promise<void>;
  onSave: (state: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  order: Order;
  services: Service[];
  text: OrderItemsText;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
        <div className="hidden md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:gap-4 md:border-b md:border-border md:px-5 md:py-3 md:text-sm md:font-semibold md:text-primary">
          <span>{text.description}</span><span>{text.quantity}</span><span>{text.unitPrice}</span><span>{text.lineTotal}</span><span />
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center md:gap-4" key={item.id}>
              <p className="text-sm font-semibold text-primary">{item.description}</p>
              <p className="flex items-center justify-between gap-3 text-sm text-muted md:block">
                <span className="font-medium md:hidden">{text.quantity}</span>
                <span>{formatQuantity(item.quantity, locale)} {text.unitTypes[item.unitType]}</span>
              </p>
              <p className="flex items-center justify-between gap-3 text-sm text-muted md:block">
                <span className="font-medium md:hidden">{text.unitPrice}</span>
                <span>{formatCurrency(item.unitPrice, order.currency, locale)}</span>
              </p>
              <p className="flex items-center justify-between gap-3 text-sm font-semibold text-primary md:block md:font-normal md:text-muted">
                <span className="font-medium md:hidden">{text.lineTotal}</span>
                <span>{formatCurrency(item.lineTotal, order.currency, locale)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isPending}
                  onClick={() => setEditingItemId((current) => current === item.id ? null : item.id)}
                  type="button"
                  variant="secondary"
                >
                  {text.edit}
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => startTransition(() => { void onRemove(item.id); })}
                  type="button"
                  variant="secondary"
                >
                  {isPending ? text.removing : text.remove}
                </Button>
              </div>
              {editingItemId === item.id ? (
                <div className="rounded-card border border-border bg-primary-soft/40 p-4 md:col-span-5">
                  <OrderItemForm
                    action={onSave}
                    item={item}
                    locale={locale}
                    onCancel={() => setEditingItemId(null)}
                    onSuccess={() => setEditingItemId(null)}
                    services={services}
                    text={{
                      addItem: text.saveEdit,
                      cancel: text.cancel,
                      description: text.description,
                      error: text.error,
                      notes: "",
                      categoryLabels: text.categoryLabels,
                      quantity: text.quantity,
                      saving: text.saving,
                      search: text.search,
                      searchPlaceholder: text.searchPlaceholder,
                      service: text.service,
                      unitPrice: text.unitPrice,
                      unitType: text.unitType,
                      unitTypes: text.unitTypes,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-auto grid w-full max-w-sm gap-3 rounded-card border border-primary/15 bg-primary-soft/55 p-4 text-sm">
        <div className="flex justify-between"><span>{text.subtotal}</span><strong>{formatCurrency(order.subtotal, order.currency, locale)}</strong></div>
        <div className="flex justify-between border-t border-primary/10 pt-3 text-base text-primary"><span className="font-semibold">{text.total}</span><strong>{formatCurrency(order.total, order.currency, locale)}</strong></div>
      </div>
    </div>
  );
}
