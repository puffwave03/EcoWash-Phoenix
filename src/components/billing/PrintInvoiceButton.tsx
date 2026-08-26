"use client";

import { Button } from "@/components/Button";

export function PrintInvoiceButton({ label }: { label: string }) {
  return <Button onClick={() => window.print()} type="button" variant="secondary">{label}</Button>;
}
