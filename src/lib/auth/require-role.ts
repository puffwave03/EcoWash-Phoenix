import "server-only";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import type { AppRole, DashboardAccess } from "@/lib/auth/types";

export async function requireRole(
  locale: string,
  allowedRoles: AppRole[],
): Promise<DashboardAccess> {
  const access = await requireMembership(locale);

  if (!allowedRoles.includes(access.membership.role)) {
    redirect(`/${locale}/app/access-denied`);
  }

  return access;
}

export function requireOwner(locale: string) {
  return requireRole(locale, ["owner"]);
}

export function requireOwnerOrManager(locale: string) {
  return requireRole(locale, ["owner", "manager"]);
}
