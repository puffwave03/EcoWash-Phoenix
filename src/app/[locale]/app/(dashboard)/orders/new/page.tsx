import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { OrderForm } from "@/components/orders/OrderForm";
import { createOrderAction } from "@/features/orders/server/actions";
import {
  listCustomersForOrder,
  listPropertiesForCustomer,
} from "@/features/orders/server/queries";

type NewOrderPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewOrderPage({ params }: NewOrderPageProps) {
  const { locale } = await params;
  const [customers, properties, t] = await Promise.all([
    listCustomersForOrder(locale),
    listPropertiesForCustomer(locale),
    getTranslations({ locale, namespace: "common.orders.form" }),
  ]);

  return (
    <Card className="space-y-6">
      <h2 className="text-2xl font-semibold text-primary">{t("newTitle")}</h2>
      <OrderForm
        action={createOrderAction.bind(null, locale)}
        customers={customers}
        properties={properties}
        text={{
          customer: t("customer"),
          customerNotes: t("customerNotes"),
          dueAt: t("dueAt"),
          error: t("error"),
          express: t("express"),
          internalNotes: t("internalNotes"),
          normal: t("normal"),
          priority: t("priority"),
          property: t("property"),
          save: t("save"),
          saving: t("saving"),
        }}
      />
    </Card>
  );
}
