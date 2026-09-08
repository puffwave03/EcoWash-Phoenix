"use client";

import { Button } from "@/components/Button";

export function PrintButton({ label, printRequestedAction }: { label: string; printRequestedAction?: () => Promise<void> }) {
  async function print() {
    try {
      await printRequestedAction?.();
    } finally {
      window.print();
    }
  }

  return <Button onClick={print} type="button">{label}</Button>;
}
