type PrincipleItemProps = {
  title: string;
  description: string;
};

export function PrincipleItem({ title, description }: PrincipleItemProps) {
  return (
    <article className="rounded-card border border-white/15 bg-white/[0.04] p-5">
      <h3 className="text-lg font-semibold leading-tight text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/75">{description}</p>
    </article>
  );
}
