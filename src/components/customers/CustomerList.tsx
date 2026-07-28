import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { Customer } from "@/features/customers/types";

type CustomerListText = {
  active: string;
  business: string;
  email: string;
  empty: string;
  inactive: string;
  individual: string;
  name: string;
  phone: string;
  properties: string;
  view: string;
};

export function CustomerList({
  customers,
  locale,
  text,
}: {
  customers: Customer[];
  locale: string;
  text: CustomerListText;
}) {
  if (customers.length === 0) {
    return <Card><p className="text-sm text-muted">{text.empty}</p></Card>;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="hidden md:grid md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:gap-4 md:border-b md:border-border md:px-5 md:py-3 md:text-sm md:font-semibold md:text-primary">
        <span>{text.name}</span><span>{text.email}</span><span>{text.phone}</span><span>{text.properties}</span><span />
      </div>
      <div className="divide-y divide-border">
        {customers.map((customer) => (
          <div
            className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
            key={customer.id}
          >
            <div>
              <p className="font-semibold text-primary">{customer.displayName}</p>
              <p className="text-sm text-muted">
                {customer.customerType === "business" ? text.business : text.individual}
                {" · "}
                {customer.isActive ? text.active : text.inactive}
              </p>
            </div>
            <p className="text-sm text-muted">{customer.email || "-"}</p>
            <p className="text-sm text-muted">{customer.phone || "-"}</p>
            <p className="text-sm text-muted">{customer.propertyCount}</p>
            <Link
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              href={`/app/customers/${customer.id}`}
              locale={locale}
            >
              {text.view}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
