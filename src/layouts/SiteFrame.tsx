"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

export function SiteFrame({
  children,
  footer,
  header,
}: {
  children: ReactNode;
  footer: ReactNode;
  header: ReactNode;
}) {
  const pathname = usePathname();
  const usesAuthenticatedShell = pathname === "/app"
    || pathname.startsWith("/app/")
    || pathname === "/portal"
    || pathname.startsWith("/portal/")
    || pathname === "/platform"
    || pathname.startsWith("/platform/");

  if (usesAuthenticatedShell) return children;

  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
