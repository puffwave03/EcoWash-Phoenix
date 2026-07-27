type PrincipleItemProps = {
  title: string;
  description: string;
};

export function PrincipleItem({ title, description }: PrincipleItemProps) {
  return (
    <article className="rounded-card border border-border bg-white/80 p-5">
      <h3 className="text-lg font-semibold leading-tight text-text">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
    </article>
  );
}
