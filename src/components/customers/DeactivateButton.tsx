"use client";

import { useTransition } from "react";
import { Button } from "@/components/Button";

type DeactivateButtonProps = {
  action: () => Promise<void>;
  confirmLabel: string;
  label: string;
  pendingLabel: string;
};

export function DeactivateButton({
  action,
  confirmLabel,
  label,
  pendingLabel,
}: DeactivateButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        if (window.confirm(confirmLabel)) {
          startTransition(() => {
            void action();
          });
        }
      }}
      type="button"
      variant="secondary"
    >
      {isPending ? pendingLabel : label}
    </Button>
  );
}
