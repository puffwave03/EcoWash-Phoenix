type HeroMetricProps = {
  label: string;
  value: string;
};

export function HeroMetric({ label, value }: HeroMetricProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <p className="text-small font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
    </div>
  );
}
