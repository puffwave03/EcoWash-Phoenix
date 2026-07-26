type ValuePointProps = {
  marker: string;
  title: string;
  description: string;
};

export function ValuePoint({ marker, title, description }: ValuePointProps) {
  return (
    <article className="grid gap-4 border-t border-border py-6 sm:grid-cols-[4rem_1fr]">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-logo border border-secondary/40 bg-secondary-soft text-sm font-semibold text-primary"
      >
        {marker}
      </span>
      <div>
        <h3 className="text-xl font-semibold leading-tight text-text">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-body">
          {description}
        </p>
      </div>
    </article>
  );
}
