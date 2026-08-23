import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { CustomerOrderRequestForm } from "@/components/portal/CustomerOrderRequestForm";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import { createCustomerPortalOrderRequestAction } from "@/features/portal/server/order-request-actions";
import {
  getCustomerPortalOrderRequestOptions,
  requireCustomerPortalAccess,
} from "@/features/portal/server/queries";

type CustomerOrderRequestPageProps = {
  params: Promise<{ locale: string }>;
};

function localDateTimeMinimum(timeZone: string) {
  const value = new Date(Date.now() + 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((entry) => entry.type === type)?.value ?? ""
  );

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export default async function CustomerOrderRequestPage({
  params,
}: CustomerOrderRequestPageProps) {
  const { locale } = await params;
  const [access, options, t] = await Promise.all([
    requireCustomerPortalAccess(locale),
    getCustomerPortalOrderRequestOptions(locale),
    getTranslations({ locale, namespace: "common.portal" }),
  ]);

  return (
    <CustomerPortalShell
      customerName={access.customerName}
      locale={locale}
      text={{
        logout: t("logout"),
        navigationLabel: t("navigationLabel"),
        newRequest: t("request.nav"),
        orders: t("orders"),
        overview: t("overview"),
        title: t("title"),
      }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            {t("request.eyebrow")}
          </p>
          <h1 className="text-3xl font-semibold text-primary sm:text-4xl">
            {t("request.title")}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted">
            {t("request.description")}
          </p>
        </header>

        {options.context ? (
          <CustomerOrderRequestForm
            action={createCustomerPortalOrderRequestAction.bind(null, locale)}
            currency={options.context.currency}
            locale={locale}
            minimumPickupAt={localDateTimeMinimum(options.context.timeZone)}
            properties={options.properties}
            requestId={randomUUID()}
            services={options.services}
            text={{
              address: t("request.address"),
              addressIncomplete: t("request.addressIncomplete"),
              back: t("request.back"),
              confirm: t("request.confirm"),
              customerNotes: t("request.customerNotes"),
              customerNotesPlaceholder: t("request.customerNotesPlaceholder"),
              estimatedTotal: t("request.estimatedTotal"),
              errors: {
                generic: t("request.errors.generic"),
                invalidQuantity: t("request.errors.invalidQuantity"),
                pickupPast: t("request.errors.pickupPast"),
                property: t("request.errors.property"),
                requestedPickupAt: t("request.errors.requestedPickupAt"),
                services: t("request.errors.services"),
              },
              noProperties: t("request.noProperties"),
              noServices: t("request.noServices"),
              perPiece: t("request.perPiece"),
              perWeight: t("request.perWeight"),
              pickupHelp: t("request.pickupHelp"),
              property: t("request.property"),
              quantity: t("request.quantity"),
              requestedPickupAt: t("request.requestedPickupAt"),
              review: t("request.review"),
              reviewIntro: t("request.reviewIntro"),
              selectProperty: t("request.selectProperty"),
              serviceSelection: t("request.serviceSelection"),
              submitting: t("request.submitting"),
              unitPiece: t("request.unitPiece"),
              unitWeight: t("request.unitWeight"),
            }}
            timeZone={options.context.timeZone}
          />
        ) : (
          <Card>
            <p className="text-sm text-red-700">{t("request.loadError")}</p>
          </Card>
        )}
      </div>
    </CustomerPortalShell>
  );
}
