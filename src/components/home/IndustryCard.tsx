type IndustryCardProps = {
  title: string;
  description: string;
};

export function IndustryCard({ title, description }: IndustryCardProps) {
  return (
    <article className="border-t border-border pt-5">
      <h3 className="text-lg font-semibold leading-tight text-text">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted sm:text-body">{description}</p>
    </article>
  );
}
