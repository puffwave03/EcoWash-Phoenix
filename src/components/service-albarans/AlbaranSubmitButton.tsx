"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";

export function AlbaranSubmitButton({ label, destructive = false }: { label: string; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <Button aria-busy={pending} disabled={pending} type="submit" variant={destructive ? "danger" : "primary"}>{label}</Button>;
}
