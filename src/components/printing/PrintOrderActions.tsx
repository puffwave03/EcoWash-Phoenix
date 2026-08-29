"use client";

import { Link } from "@/i18n/navigation";

export type PrintActionText = { labels: string; receipt: string; ticket: string };
export type PrintOrderMode = keyof PrintActionText;

export function PrintOrderActions({ className = "", locale, modes = ["receipt", "ticket", "labels"], orderId, text }: {
  className?: string;
  locale: string;
  orderId: string;
  modes?: PrintOrderMode[];
  text: PrintActionText;
}) {
  const actions = [
    { href: `/app/orders/${orderId}/print/receipt`, label: text.receipt, mode: "receipt" as const },
    { href: `/app/orders/${orderId}/print/ticket`, label: text.ticket, mode: "ticket" as const },
    { href: `/app/orders/${orderId}/print/labels`, label: text.labels, mode: "labels" as const },
  ].filter((action) => modes.includes(action.mode));

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {actions.map((action) => (
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-control border border-primary/20 bg-white px-3 text-sm font-bold !text-primary transition hover:bg-primary-soft"
          href={action.href}
          key={action.href}
          locale={locale}
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
