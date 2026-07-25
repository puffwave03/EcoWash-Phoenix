type ProductionProgressProps = {
  label: string;
  value: string;
  percent: number;
};

export function ProductionProgress({
  label,
  value,
  percent,
}: ProductionProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-small">
        <span className="font-medium text-text">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
        <div
          className="h-full rounded-full bg-secondary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
