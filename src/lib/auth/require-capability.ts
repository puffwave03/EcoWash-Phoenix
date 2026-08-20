import "server-only";

import { redirect } from "next/navigation";
import { hasOperationalCapability } from "@/lib/auth/capabilities";
import type { OperationalCapability } from "@/lib/auth/capabilities";
import { requireMembership } from "@/lib/auth/require-membership";

export async function requireOperationalCapability(
  locale: string,
  capability: OperationalCapability,
) {
  const access = await requireMembership(locale);

  if (!hasOperationalCapability(access.membership, capability)) {
    redirect(`/${locale}/app/access-denied`);
  }

  return access;
}
