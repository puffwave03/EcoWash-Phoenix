"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function PlatformEntitlementForm({ action, disruptive, entitlement, text }: {
  action: (formData: FormData) => Promise<void>;
  disruptive: boolean;
  entitlement: {
    configuredEnabled: boolean;
    featureKey: string;
    limitValue: number | null;
    source: string | null;
    validFrom: string | null;
    validUntil: string | null;
  };
  text: {
    confirm: string;
    disable: string;
    enable: string;
    limit: string;
    save: string;
    source: string;
    validFrom: string;
    validUntil: string;
  };
}) {
  const [enabled, setEnabled] = useState(entitlement.configuredEnabled);
  const datetimeValue = (value: string | null) => value ? value.slice(0, 16) : "";

  return (
    <form action={action} className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
      <input name="featureKey" type="hidden" value={entitlement.featureKey} />
      <label className="space-y-1 text-sm font-medium text-primary">
        <span>{enabled ? text.enable : text.disable}</span>
        <select
          className="min-h-11 w-full rounded-control border border-border bg-white px-3"
          name="enabled"
          onChange={(event) => setEnabled(event.target.value === "true")}
          value={String(enabled)}
        >
          <option value="true">{text.enable}</option>
          <option value="false">{text.disable}</option>
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-primary">
        <span>{text.limit}</span>
        <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={entitlement.limitValue ?? ""} min="0" name="limitValue" step="1" type="number" />
      </label>
      <label className="space-y-1 text-sm font-medium text-primary">
        <span>{text.validFrom}</span>
        <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={datetimeValue(entitlement.validFrom)} name="validFrom" type="datetime-local" />
      </label>
      <label className="space-y-1 text-sm font-medium text-primary">
        <span>{text.validUntil}</span>
        <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={datetimeValue(entitlement.validUntil)} name="validUntil" type="datetime-local" />
      </label>
      <label className="space-y-1 text-sm font-medium text-primary md:col-span-2">
        <span>{text.source}</span>
        <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={entitlement.source ?? "platform_admin"} maxLength={64} name="source" />
      </label>
      {!enabled && disruptive ? (
        <label className="flex items-start gap-3 rounded-control border border-secondary/25 bg-secondary-soft p-4 text-sm leading-6 text-primary md:col-span-2">
          <input className="mt-1 h-4 w-4" name="confirmImpact" required type="checkbox" value="confirmed" />
          <span>{text.confirm}</span>
        </label>
      ) : null}
      <div className="md:col-span-2"><Button type="submit">{text.save}</Button></div>
    </form>
  );
}
