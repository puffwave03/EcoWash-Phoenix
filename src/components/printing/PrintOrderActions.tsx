"use client";

import { Link } from "@/i18n/navigation";

export type PrintActionText = { labels: string; receipt: string; ticket: string };

export function PrintOrderActions({ className = "", locale, orderId, text }: {
  className?: string;
  locale: string;
  orderId: string;
  text: PrintActionText;
}) {
  const actions = [
    { href: `/app/orders/${orderId}/print/receipt`, label: text.receipt },
    { href: `/app/orders/${orderId}/print/ticket`, label: text.ticket },
    { href: `/app/orders/${orderId}/print/labels`, label: text.labels },
  ];

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
