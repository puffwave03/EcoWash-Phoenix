"use client";

import { useTransition } from "react";
import { Button } from "@/components/Button";

export function CustomerLifecycleButton({
  action,
  confirmLabel,
  label,
  pendingLabel,
  variant,
}: {
  action: () => Promise<void>;
  confirmLabel?: string;
  label: string;
  pendingLabel: string;
  variant: "danger" | "primary";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        if (!confirmLabel || window.confirm(confirmLabel)) {
          startTransition(() => void action());
        }
      }}
      type="button"
      variant={variant}
    >
      {isPending ? pendingLabel : label}
    </Button>
  );
}
