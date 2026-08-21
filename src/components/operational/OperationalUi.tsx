import type { ReactNode } from "react";

export const operationalPrimaryActionClasses =
  "inline-flex min-h-12 w-full items-center justify-center rounded-control border border-primary/25 bg-primary-soft px-5 text-center text-sm font-semibold text-primary-strong shadow-sm transition-standard hover:border-primary/35 hover:bg-[#dcebe4] hover:text-primary-strong active:bg-[#d1e4da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export type Tone = "critical" | "info" | "neutral" | "success" | "warning";

const toneClasses: Record<Tone, {
  badge: string;
  card: string;
  dot: string;
  number: string;
}> = {
  critical: {
    badge: "border-red-200 bg-red-50 text-red-700",
    card: "border-red-200 bg-red-50/45",
    dot: "bg-red-600",
    number: "text-red-700",
  },
  info: {
    badge: "border-primary-soft bg-primary-soft text-primary",
    card: "border-primary-soft bg-primary-soft/45",
    dot: "bg-primary",
    number: "text-primary",
  },
  neutral: {
    badge: "border-border bg-[#f7f7f4] text-muted",
    card: "border-border bg-white",
    dot: "bg-muted",
    number: "text-primary",
  },
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    card: "border-emerald-200 bg-emerald-50/45",
    dot: "bg-emerald-600",
    number: "text-emerald-700",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    card: "border-amber-200 bg-amber-50/50",
    dot: "bg-amber-500",
    number: "text-amber-800",
  },
};

export function PageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="rounded-card border border-border bg-white px-5 py-5 shadow-card sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-2xl font-semibold text-primary sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

export function SummaryCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: Tone;
  value: number | string;
}) {
  return (
    <div className={`rounded-card border px-4 py-4 shadow-sm ${toneClasses[tone].card}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${toneClasses[tone].dot}`} />
      </div>
      <p className={`mt-3 text-3xl font-semibold leading-none ${toneClasses[tone].number}`}>
        {value}
      </p>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-semibold leading-none ${toneClasses[tone].badge}`}>
      {children}
    </span>
  );
}

export function SectionHeader({
  count,
  tone = "neutral",
  title,
}: {
  count: number;
  tone?: Tone;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-primary">{title}</h3>
      <StatusBadge tone={tone}>{count}</StatusBadge>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-[#fbfbf8] px-4 py-7 text-center text-sm leading-6 text-muted">
      {children}
    </div>
  );
}
