import { Card } from "@/components/Card";

type SolutionCardProps = {
  marker: string;
  title: string;
  description: string;
};

export function SolutionCard({ marker, title, description }: SolutionCardProps) {
  return (
    <Card className="flex h-full flex-col gap-5 bg-white/92 p-5 shadow-editorial sm:p-6">
      <div
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-logo border border-gold/30 bg-gold-soft text-sm font-semibold text-primary"
      >
        {marker}
      </div>
      <div>
        <h3 className="text-xl font-semibold leading-tight text-text">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-body">
          {description}
        </p>
      </div>
    </Card>
  );
}
