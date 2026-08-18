import { Link } from "@/i18n/navigation";
import { Card } from "@/components/Card";

type WorkExperienceLandingText = {
  controlDescription: string;
  controlTitle: string;
  delivery: string;
  deliveryDescription: string;
  eyebrow: string;
  nextDescription: string;
  nextTitle: string;
  pickup: string;
  pickupDescription: string;
  production: string;
  productionDescription: string;
  quality: string;
  qualityDescription: string;
  staffDescription: string;
  staffTitle: string;
  startDelivery: string;
  startProduction: string;
  title: string;
};

type WorkExperienceLandingProps = {
  isControlRole: boolean;
  locale: string;
  profileName: string;
  text: WorkExperienceLandingText;
};

export function WorkExperienceLanding({
  isControlRole,
  locale,
  profileName,
  text,
}: WorkExperienceLandingProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-card bg-[#09291f] px-5 py-6 text-white shadow-card sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          {text.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          {isControlRole ? text.controlTitle : text.staffTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
          {isControlRole ? text.controlDescription : text.staffDescription}
        </p>
        <p className="mt-5 text-sm font-semibold text-secondary">
          {profileName}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          className="inline-flex min-h-14 items-center justify-center rounded-control bg-primary px-5 text-center text-sm font-semibold text-white shadow-card transition-standard hover:bg-primary-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href="/app/production"
          locale={locale}
        >
          {text.startProduction}
        </Link>
        <Link
          className="inline-flex min-h-14 items-center justify-center rounded-control border border-primary bg-white px-5 text-center text-sm font-semibold text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href="/app/delivery"
          locale={locale}
        >
          {text.startDelivery}
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {text.nextTitle}
          </p>
          <h3 className="text-xl font-semibold text-primary">{text.title}</h3>
          <p className="text-sm leading-6 text-muted">{text.nextDescription}</p>
        </Card>

        <div className="grid gap-3">
          <WorkAreaCard title={text.pickup} description={text.pickupDescription} />
          <WorkAreaCard title={text.production} description={text.productionDescription} />
          <WorkAreaCard title={text.quality} description={text.qualityDescription} />
          <WorkAreaCard title={text.delivery} description={text.deliveryDescription} />
        </div>
      </section>
    </div>
  );
}

function WorkAreaCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <article className="rounded-card border border-border bg-white px-4 py-4 shadow-sm">
      <h4 className="text-base font-semibold text-primary">{title}</h4>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </article>
  );
}
