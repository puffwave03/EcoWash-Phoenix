"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import type { PlatformSimplifiedInvoicingStatus } from "@/features/platform-admin/types";

export function PlatformSimplifiedInvoicingControl({
  action,
  status,
  text,
}: {
  action: (formData: FormData) => Promise<void>;
  status: PlatformSimplifiedInvoicingStatus;
  text: {
    title: string;
    description: string;
    enabled: string;
    disabled: string;
    billingEntitlement: string;
    simplifiedSeries: string;
    fiscalProfile: string;
    issuerConfiguration: string;
    ready: string;
    incomplete: string;
    enable: string;
    disable: string;
    confirmEnable: string;
    confirmDisable: string;
    preserved: string;
    legalBoundary: string;
  };
}) {
  const nextEnabled = !status.enabled;
  const [confirmed, setConfirmed] = useState(false);
  const checks = [
    [text.billingEntitlement, status.billingEntitlementEnabled],
    [text.simplifiedSeries, status.simplifiedSeriesReady],
    [text.fiscalProfile, status.fiscalProfileReady],
    [text.issuerConfiguration, status.issuerConfigurationReady],
  ] as const;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-primary">{text.title}</h2>
        <p className="mt-2 text-sm text-muted">{text.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${status.enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {status.enabled ? text.enabled : text.disabled}
        </span>
        <span className={`text-sm font-medium ${checks.every(([, ready]) => ready) ? "text-emerald-800" : "text-amber-800"}`}>
          {checks.every(([, ready]) => ready) ? text.ready : text.incomplete}
        </span>
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {checks.map(([label, ready]) => (
          <li className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2" key={label}>
            <span className="text-primary">{label}</span>
            <span className={ready ? "font-medium text-emerald-800" : "font-medium text-amber-800"}>{ready ? "✓" : "—"}</span>
          </li>
        ))}
      </ul>
      <form action={action} className="space-y-4 border-t border-border pt-4">
        <input name="enabled" type="hidden" value={String(nextEnabled)} />
        <label className="flex items-start gap-3 rounded-control border border-secondary/25 bg-secondary-soft p-4 text-sm leading-6 text-primary">
          <input
            checked={confirmed}
            className="mt-1 h-4 w-4"
            name="confirmChange"
            onChange={(event) => setConfirmed(event.target.checked)}
            required
            type="checkbox"
            value="confirmed"
          />
          <span>{nextEnabled ? text.confirmEnable : text.confirmDisable}</span>
        </label>
        <p className="text-xs text-muted">{text.preserved}</p>
        <p className="text-xs text-muted">{text.legalBoundary}</p>
        <Button
          disabled={!confirmed || (nextEnabled && !checks.every(([, ready]) => ready))}
          type="submit"
          variant={nextEnabled ? "primary" : "danger"}
        >
          {nextEnabled ? text.enable : text.disable}
        </Button>
      </form>
    </section>
  );
}
