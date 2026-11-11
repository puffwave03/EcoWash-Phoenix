import { getTranslations } from "next-intl/server";

export default async function AlbaranRegisterLoading() {
  const t = await getTranslations("common.serviceAlbarans");
  return <div role="status" aria-busy="true" className="rounded-card border border-border bg-white p-6 text-sm text-muted">{t("register.loading")}</div>;
}
