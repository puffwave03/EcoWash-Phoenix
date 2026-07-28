import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { OrderForm } from "@/components/orders/OrderForm";
import { updateOrderAction } from "@/features/orders/server/actions";
import {
  getOrderById,
  listCustomersForOrder,
  listPropertiesForCustomer,
} from "@/features/orders/server/queries";

type EditOrderPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const { locale, orderId } = await params;
  const [order, customers, properties, t] = await Promise.all([
    getOrderById(locale, orderId),
    listCustomersForOrder(locale),
    listPropertiesForCustomer(locale),
    getTranslations({ locale, namespace: "common.orders.form" }),
  ]);

  return (
    <Card className="space-y-6">
      <h2 className="text-2xl font-semibold text-primary">{t("editTitle")}</h2>
      <OrderForm
        action={updateOrderAction.bind(null, locale, orderId)}
        customers={customers}
        order={order}
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
