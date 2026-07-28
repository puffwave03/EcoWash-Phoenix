"use client";

import { useTransition } from "react";
import { Button } from "@/components/Button";
import type { Order, OrderItem } from "@/features/orders/types";

type OrderItemsText = {
  description: string;
  lineTotal: string;
  quantity: string;
  remove: string;
  removing: string;
  subtotal: string;
  total: string;
  unitPrice: string;
};

function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(amount);
}

export function OrderItems({
  items,
  locale,
  onRemove,
  order,
  text,
}: {
  items: OrderItem[];
  locale: string;
  onRemove: (itemId: string) => Promise<void>;
  order: Order;
  text: OrderItemsText;
}) {
  const [isPending, startTransition] = useTransition();

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
              <p className="text-sm text-muted">{item.quantity} {item.unitType}</p>
              <p className="text-sm text-muted">{formatMoney(item.unitPrice, order.currency, locale)}</p>
              <p className="text-sm text-muted">{formatMoney(item.lineTotal, order.currency, locale)}</p>
              <Button
                disabled={isPending}
                onClick={() => startTransition(() => { void onRemove(item.id); })}
                type="button"
                variant="secondary"
              >
                {isPending ? text.removing : text.remove}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-auto grid max-w-sm gap-2 rounded-card border border-border bg-white p-4 text-sm shadow-card">
        <div className="flex justify-between"><span>{text.subtotal}</span><strong>{formatMoney(order.subtotal, order.currency, locale)}</strong></div>
        <div className="flex justify-between"><span>{text.total}</span><strong>{formatMoney(order.total, order.currency, locale)}</strong></div>
      </div>
    </div>
  );
}
