"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";

export function BillingIssuerSaveControls({ label, pendingLabel, savedLabel, saved }: {
  label: string;
  pendingLabel: string;
  savedLabel: string;
  saved: boolean;
}) {
  const { pending } = useFormStatus();
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (saved && !pending) {
      feedback.current?.focus({ preventScroll: true });
      feedback.current?.scrollIntoView({ block: "center" });
    }
  }, [saved, pending]);

  return (
    <div className="flex scroll-mt-24 flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3" id="issuer-save-feedback" ref={feedback} tabIndex={-1}>
      <Button aria-busy={pending} disabled={pending} type="submit">{pending ? pendingLabel : label}</Button>
      <p aria-atomic="true" aria-live="polite" className="text-sm font-semibold text-emerald-700" role="status">
        {pending ? pendingLabel : saved ? savedLabel : null}
      </p>
    </div>
  );
}
