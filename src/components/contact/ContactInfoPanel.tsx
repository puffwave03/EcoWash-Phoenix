import { useTranslations } from "next-intl";
import { Card } from "@/components/Card";

const infoItems = ["product", "stage", "users", "languages"] as const;

export function ContactInfoPanel() {
  const t = useTranslations("contact.info");

  return (
    <Card className="bg-surface p-6 lg:sticky lg:top-28">
      <h2 className="text-h3 font-semibold text-text">{t("title")}</h2>
      <dl className="mt-6 space-y-5">
        {infoItems.map((item) => (
          <div className="border-t border-border pt-5" key={item}>
            <dt className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
              {t(`${item}.label`)}
            </dt>
            <dd className="mt-2 text-body leading-7 text-text">
              {t(`${item}.value`)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
