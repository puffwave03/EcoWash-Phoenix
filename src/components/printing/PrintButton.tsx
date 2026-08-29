"use client";

import { Button } from "@/components/Button";

export function PrintButton({ label }: { label: string }) {
  return <Button onClick={() => window.print()} type="button">{label}</Button>;
}
