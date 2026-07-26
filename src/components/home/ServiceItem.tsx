type ServiceItemProps = {
  title: string;
  description: string;
};

export function ServiceItem({ title, description }: ServiceItemProps) {
  return (
    <div className="grid gap-4 border-t border-white/15 py-6 sm:grid-cols-[10rem_1fr] sm:items-start">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="block size-2.5 rounded-full bg-accent"
        />
        <h3 className="text-lg font-semibold leading-tight text-white">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-white/72 sm:text-body">{description}</p>
    </div>
  );
}
