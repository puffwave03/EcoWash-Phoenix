import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function PaymentReadErrorNotice({ locale, orderId }: { locale: string; orderId?: string }) {
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <div className="rounded-control border border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
      <p className="font-semibold">{t("orders.payments.readError")}</p>
      {orderId ? (
        <Link className="mt-3 inline-flex min-h-11 items-center underline" href={`/app/orders/${orderId}`} locale={locale}>
          {t("print.actions.back")}
        </Link>
      ) : null}
    </div>
  );
}
