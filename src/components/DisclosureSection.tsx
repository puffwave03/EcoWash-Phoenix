"use client";

import { useId, useState, type ReactNode } from "react";

export function DisclosureSection({
  children,
  actionLabel,
  contentClassName = "",
  count,
  defaultOpen = false,
  id,
  summary,
  statusLabel,
  statusTone = "neutral",
  title,
}: {
  actionLabel?: string;
  children: ReactNode;
  contentClassName?: string;
  count?: number;
  defaultOpen?: boolean;
  id?: string;
  summary?: string;
  statusLabel?: string;
  statusTone?: "neutral" | "success" | "warning";
  title: string;
}) {
  const generatedId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const buttonId = `${generatedId}-button`;
  const contentId = `${generatedId}-content`;
  const statusClass = statusTone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : statusTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-border bg-[#f5f7f5] text-muted";

  return (
    <section aria-labelledby={buttonId} className="scroll-mt-24 space-y-3" id={id}>
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="flex min-h-16 w-full items-center justify-between gap-4 rounded-card border border-border bg-white px-4 py-3 text-left shadow-card transition-standard hover:border-primary/35 hover:bg-primary-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-5"
        id={buttonId}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block text-lg font-semibold tracking-tight text-primary">
            {title}{typeof count === "number" ? ` · ${count}` : ""}
          </span>
          {summary ? <span className="mt-0.5 block break-words text-sm font-normal leading-5 text-muted">{summary}</span> : null}
        </span>
        <span className="flex max-w-[48%] shrink-0 flex-col items-end gap-1.5 sm:max-w-none sm:flex-row sm:items-center sm:gap-3">
          {statusLabel ? <span className={`max-w-full rounded-full border px-2.5 py-1 text-right text-xs font-semibold leading-tight ${statusClass}`}>{statusLabel}</span> : null}
          <span className="flex max-w-full items-center justify-end gap-1.5 text-right text-xs font-semibold leading-tight text-primary">
            {actionLabel ? <span className="break-words">{actionLabel}</span> : null}
            <svg
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </span>
        </span>
      </button>
      <div className={contentClassName} hidden={!isOpen} id={contentId}>
        {children}
      </div>
    </section>
  );
}
