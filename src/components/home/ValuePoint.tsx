type ValuePointProps = {
  marker: string;
  title: string;
  description: string;
};

export function ValuePoint({ marker, title, description }: ValuePointProps) {
  return (
    <article className="rounded-card border border-border bg-surface p-5 shadow-card">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-logo border border-gold/40 bg-gold-soft text-sm font-semibold text-primary"
      >
        {marker}
      </span>
      <div>
        <h3 className="mt-5 text-xl font-semibold leading-tight text-text">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-body">
          {description}
        </p>
      </div>
    </article>
  );
}
