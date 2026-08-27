"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function PlatformStatusForm({ action, currentStatus, text }: {
  action: (formData: FormData) => Promise<void>;
  currentStatus: "active" | "suspended";
  text: {
    active: string;
    confirm: string;
    reactivate: string;
    suspend: string;
    suspended: string;
  };
}) {
  const nextStatus = currentStatus === "active" ? "suspended" : "active";
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input name="status" type="hidden" value={nextStatus} />
      <p className="text-sm text-muted">{currentStatus === "active" ? text.active : text.suspended}</p>
      {nextStatus === "suspended" ? (
        <label className="flex items-start gap-3 rounded-control border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-primary">
          <input checked={confirmed} className="mt-1 h-4 w-4" name="confirmSuspension" onChange={(event) => setConfirmed(event.target.checked)} required type="checkbox" value="confirmed" />
          <span>{text.confirm}</span>
        </label>
      ) : null}
      <Button disabled={nextStatus === "suspended" && !confirmed} type="submit" variant={nextStatus === "suspended" ? "danger" : "primary"}>
        {nextStatus === "suspended" ? text.suspend : text.reactivate}
      </Button>
    </form>
  );
}
