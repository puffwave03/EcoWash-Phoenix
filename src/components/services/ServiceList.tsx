import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/features/services/types";
import { catalogCategoryLabel, groupServicesByCategory } from "@/features/services/catalog";
import { formatCurrency } from "@/lib/number-format";

type ServiceListText = {
  active: string;
  edit: string;
  empty: string;
  inactive: string;
  categoryLabels: Record<string, string>;
  fromPrice: string;
  price: string;
  service: string;
  unitTypes: Record<Service["unitType"], string>;
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
    <div className="space-y-5">
      {groupServicesByCategory(services).map(({ category, items }) => (
        <section className="overflow-hidden rounded-card border border-border bg-white shadow-card" key={category}>
          <div className="border-b border-border bg-primary-soft/55 px-5 py-3">
            <h3 className="font-semibold text-primary">{catalogCategoryLabel(category, text.categoryLabels)}</h3>
          </div>
          <div className="hidden md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:gap-4 md:border-b md:border-border md:px-5 md:py-3 md:text-sm md:font-semibold md:text-primary">
            <span>{text.service}</span><span>{text.price}</span><span>{text.active}</span><span>{text.unitTypes.piece}</span><span />
          </div>
          <div className="divide-y divide-border">
        {items.map((service) => (
          <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center md:gap-4" key={service.id}>
            <div>
              <p className="font-semibold text-primary">{service.name}</p>
              <p className="text-sm text-muted">{service.code || service.category || "-"}</p>
            </div>
            <p className="text-sm text-muted">
              {service.amount === null ? "-" : `${service.priceIsFrom ? `${text.fromPrice} ` : ""}${formatCurrency(service.amount, service.currency ?? "EUR", locale)}`}
            </p>
            <p className="text-sm text-muted">{service.isActive ? text.active : text.inactive}</p>
            <p className="text-sm text-muted">{text.unitTypes[service.unitType]}</p>
            {canManage ? (
              <Link href={`/app/services/${service.id}/edit`} locale={locale}>
                <Button variant="secondary">{text.edit}</Button>
              </Link>
            ) : null}
          </div>
        ))}
          </div>
        </section>
      ))}
    </div>
  );
}
