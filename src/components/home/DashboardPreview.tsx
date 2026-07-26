import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/BrandLogo";
import { HeroMetric } from "@/components/home/HeroMetric";
import { ProductionProgress } from "@/components/home/ProductionProgress";

const metrics = ["activeOrders", "inProduction", "deliveries"] as const;

const productionSteps = [
  { key: "washing", percent: 82 },
  { key: "drying", percent: 64 },
  { key: "ironing", percent: 48 },
  { key: "ready", percent: 76 },
] as const;

export function DashboardPreview() {
  const t = useTranslations("home.hero.preview");

  return (
    <div
      aria-hidden="true"
      data-dashboard-preview="true"
      className="relative mx-auto w-full min-w-0 max-w-xl rounded-[1.5rem] border border-border bg-surface p-3 shadow-luxury"
    >
      <div className="overflow-hidden rounded-[1.25rem] border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-secondary" />
            <span className="size-2.5 rounded-full bg-accent" />
            <span className="size-2.5 rounded-full bg-primary" />
          </div>
          <div className="h-2 w-24 rounded-full bg-primary-soft" />
        </div>

        <div className="grid min-h-[34rem] grid-cols-1 xl:grid-cols-[9rem_1fr]">
          <aside className="hidden border-r border-border bg-primary px-4 py-6 text-white xl:block">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex items-center justify-center rounded-logo bg-white px-2 py-1">
                <BrandLogo alt="" size="dashboard" />
              </div>
              <div className="h-2 w-16 rounded-full bg-white/40" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <div
                  className="h-8 rounded-control bg-white/10"
                  key={item}
                />
              ))}
            </div>
          </aside>

          <div className="min-w-0 space-y-5 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
                  {t("subtitle")}
                </p>
                <h2 className="mt-2 text-h3 font-semibold text-text">
                  {t("title")}
                </h2>
              </div>
              <div className="rounded-control border border-border bg-surface px-3 py-2 text-small font-medium text-primary">
                {t("delivery.status")}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <HeroMetric
                  key={metric}
                  label={t(`metrics.${metric}.label`)}
                  value={t(`metrics.${metric}.value`)}
                />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <div className="rounded-card border border-border bg-surface p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text">
                  {t("orders.title")}
                </h3>
                <div className="mt-4 space-y-3">
                  {[0, 1, 2].map((order) => (
                    <div
                      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-border bg-background p-3"
                      key={order}
                    >
                      <div>
                        <p className="text-sm font-semibold text-text">
                          {t(`orders.items.${order}.customer`)}
                        </p>
                        <p className="mt-1 text-small text-muted">
                          {t(`orders.items.${order}.status`)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        {t(`orders.items.${order}.amount`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-card border border-border bg-surface p-4 shadow-card">
                  <h3 className="text-sm font-semibold text-text">
                    {t("production.title")}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {productionSteps.map((step) => (
                      <ProductionProgress
                        key={step.key}
                        label={t(`production.${step.key}.label`)}
                        percent={step.percent}
                        value={t(`production.${step.key}.value`)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-card border border-secondary/40 bg-secondary-soft p-4">
                  <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
                    {t("delivery.title")}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-text">
                    {t("delivery.route")}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="size-3 rounded-full bg-primary" />
                    <div className="h-1 flex-1 rounded-full bg-secondary" />
                    <span className="size-3 rounded-full bg-accent" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
