import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { OrderForm } from "@/components/orders/OrderForm";
import { createOrderAction } from "@/features/orders/server/actions";
import {
  listCustomersForOrder,
  listPropertiesForCustomer,
} from "@/features/orders/server/queries";

type NewOrderPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string }>;
};

export default async function NewOrderPage({ params, searchParams }: NewOrderPageProps) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const [customers, properties, t] = await Promise.all([
    listCustomersForOrder(locale),
    listPropertiesForCustomer(locale),
    getTranslations({ locale, namespace: "common.orders" }),
  ]);
  const steps = [
    t("form.steps.details"),
    t("form.steps.services"),
    t("form.steps.summary"),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        description={t("form.newDescription")}
        title={t("form.newTitle")}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1" aria-label={t("form.newTitle")}>
          {steps.map((step, index) => (
            <li
              className={`flex min-h-14 items-center gap-3 rounded-control border px-3 py-2.5 text-sm font-semibold ${
                index === 0
                  ? "border-primary/20 bg-primary-soft text-primary"
                  : "border-border bg-white text-muted"
              }`}
              key={step}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                index === 0 ? "bg-primary text-white" : "bg-[#eef1ee] text-muted"
              }`}>
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <Card className="min-w-0">
          <OrderForm
            action={createOrderAction.bind(null, locale)}
            customers={customers}
            initialCustomerId={customers.some((customer) => customer.id === rawSearchParams.customerId) ? rawSearchParams.customerId : undefined}
            properties={properties}
            text={{
              customer: t("form.customer"),
              customerNotes: t("form.customerNotes"),
              dueAt: t("form.dueAt"),
              error: t("form.error"),
              express: t("form.express"),
              internalNotes: t("form.internalNotes"),
              normal: t("form.normal"),
              priority: t("form.priority"),
              property: t("form.property"),
              save: t("form.save"),
              saving: t("form.saving"),
            }}
          />
        </Card>
      </div>
    </div>
  );
}
