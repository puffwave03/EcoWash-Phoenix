import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/features/services/types";
import { formatCurrency } from "@/lib/number-format";

type ServiceListText = {
  active: string;
  edit: string;
  empty: string;
  inactive: string;
  piece: string;
  price: string;
  service: string;
  weight: string;
};

export function ServiceList({
  canManage,
  locale,
  services,
  text,
}: {
  canManage: boolean;
  locale: string;
  services: Service[];
  text: ServiceListText;
}) {
  if (services.length === 0) {
    return <Card><p className="text-sm text-muted">{text.empty}</p></Card>;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="hidden md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:gap-4 md:border-b md:border-border md:px-5 md:py-3 md:text-sm md:font-semibold md:text-primary">
        <span>{text.service}</span><span>{text.price}</span><span>{text.active}</span><span>{text.piece}</span><span />
      </div>
      <div className="divide-y divide-border">
        {services.map((service) => (
          <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center md:gap-4" key={service.id}>
            <div>
              <p className="font-semibold text-primary">{service.name}</p>
              <p className="text-sm text-muted">{service.code || service.category || "-"}</p>
            </div>
            <p className="text-sm text-muted">
              {service.amount === null ? "-" : formatCurrency(service.amount, service.currency ?? "EUR", locale)}
            </p>
            <p className="text-sm text-muted">{service.isActive ? text.active : text.inactive}</p>
            <p className="text-sm text-muted">{service.unitType === "weight" ? text.weight : text.piece}</p>
            {canManage ? (
              <Link href={`/app/services/${service.id}/edit`} locale={locale}>
                <Button variant="secondary">{text.edit}</Button>
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
