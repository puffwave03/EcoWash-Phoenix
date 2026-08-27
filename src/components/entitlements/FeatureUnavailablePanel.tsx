import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";

export function FeatureUnavailablePanel({
  backLabel,
  description,
  eyebrow,
  embedded = false,
  locale,
  title,
}: {
  backLabel: string;
  description: string;
  eyebrow: string;
  embedded?: boolean;
  locale: string;
  title: string;
}) {
  return (
    <Card className="mx-auto max-w-2xl border-primary/15 bg-white p-6 shadow-card sm:p-8">
      <div className="h-1 w-16 rounded-full bg-secondary" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{eyebrow}</p>
      {embedded
        ? <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        : <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>}
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">{description}</p>
      <Link className="mt-6 inline-flex min-h-11 items-center rounded-control border border-border bg-white px-4 text-sm font-semibold !text-primary transition-standard hover:bg-primary-soft" href="/app" locale={locale}>
        {backLabel}
      </Link>
    </Card>
  );
}
