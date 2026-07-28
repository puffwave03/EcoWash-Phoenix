import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { Property } from "@/features/customers/types";

export function PropertyList({
  empty,
  locale,
  properties,
  view,
}: {
  empty: string;
  locale: string;
  properties: Property[];
  view: string;
}) {
  if (properties.length === 0) {
    return <Card><p className="text-sm text-muted">{empty}</p></Card>;
  }

  return (
    <div className="grid gap-3">
      {properties.map((property) => (
        <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" key={property.id}>
          <div>
            <p className="font-semibold text-primary">{property.name}</p>
            <p className="text-sm text-muted">
              {[property.city, property.addressLine1].filter(Boolean).join(" · ") || property.customerDisplayName}
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            href={`/app/properties/${property.id}`}
            locale={locale}
          >
            {view}
          </Link>
        </Card>
      ))}
    </div>
  );
}
