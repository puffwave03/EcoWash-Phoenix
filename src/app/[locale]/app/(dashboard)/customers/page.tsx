import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CustomerList } from "@/components/customers/CustomerList";
import { Link } from "@/i18n/navigation";
import { listCustomers } from "@/features/customers/server/queries";
import { parseStatusFilter } from "@/features/customers/server/validation";

type CustomersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function CustomersPage({
  params,
  searchParams,
}: CustomersPageProps) {
  const { locale } = await params;
  const { q = "", status = "active" } = await searchParams;
  const t = await getTranslations({ locale, namespace: "common.customers" });
  const customers = await listCustomers(locale, {
    query: q.trim(),
    status: parseStatusFilter(status),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
          <p className="mt-2 text-sm text-muted">{t("description")}</p>
        </div>
        <Link href="/app/customers/new" locale={locale}>
          <Button>{t("newCustomer")}</Button>
        </Link>
      </div>

      <Card>
        <form className="grid gap-4 md:grid-cols-[1fr_12rem_auto]">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("search")}</span>
            <input
              className="min-h-11 w-full rounded-control border border-border px-3 text-sm"
              defaultValue={q}
              name="q"
              placeholder={t("searchPlaceholder")}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("status")}</span>
            <select
              className="min-h-11 w-full rounded-control border border-border px-3 text-sm"
              defaultValue={status}
              name="status"
            >
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
              <option value="all">{t("all")}</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit">{t("filter")}</Button>
          </div>
        </form>
      </Card>

      <CustomerList
        customers={customers}
        locale={locale}
        text={{
          active: t("active"),
          business: t("types.business"),
          email: t("email"),
          empty: t("empty"),
          inactive: t("inactive"),
          individual: t("types.individual"),
          name: t("name"),
          phone: t("phone"),
          properties: t("properties"),
          view: t("view"),
        }}
      />
    </div>
  );
}
