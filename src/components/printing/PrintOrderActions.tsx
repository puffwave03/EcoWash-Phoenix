"use client";

import { Link } from "@/i18n/navigation";
import { useFormStatus } from "react-dom";
import { issueOperationalReceiptAction } from "@/features/sales-documents/server/actions";

export type PrintActionText = { "customer-copy": string; labels: string; receipt: string; ticket: string };
export type PrintOrderMode = keyof PrintActionText;
export type CustomerCopyFormatText = { a4: string; "58mm": string; "80mm": string };

function ReceiptIssueButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      className="min-h-11 rounded-control border border-primary/20 bg-white px-3 text-sm font-bold text-primary disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {label}
    </button>
  );
}

export function PrintOrderActions({ className = "", customerCopyFormats, locale, modes = ["customer-copy", "ticket", "labels", "receipt"], orderId, text }: {
  className?: string;
  customerCopyFormats?: CustomerCopyFormatText;
  locale: string;
  orderId: string;
  modes?: PrintOrderMode[];
  text: PrintActionText;
}) {
  const actions = [
    ...(customerCopyFormats
      ? (["a4", "58mm", "80mm"] as const).map((format) => ({
        href: `/app/orders/${orderId}/print/customer-copy?format=${format}`,
        label: customerCopyFormats[format], mode: "customer-copy" as const,
      }))
      : [{ href: `/app/orders/${orderId}/print/customer-copy`, label: text["customer-copy"], mode: "customer-copy" as const }]),
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
      {modes.includes("receipt") ? (
        <form action={issueOperationalReceiptAction.bind(null, locale, orderId)}>
          <ReceiptIssueButton label={text.receipt} />
        </form>
      ) : null}
    </div>
  );
}
