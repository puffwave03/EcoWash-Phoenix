import "server-only";

import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/get-current-membership";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { requireAuth } from "@/lib/auth/require-auth";
import type { DashboardAccess } from "@/lib/auth/types";

export async function requireMembership(locale: string): Promise<DashboardAccess> {
  const user = await requireAuth(locale);
  const profile = await getCurrentProfile(user.id);

  if (!profile) {
    redirect(`/${locale}/app/access-denied`);
  }

  const { issue, membership } = await getCurrentMembership(profile.id);

  if (issue || !membership) {
    redirect(`/${locale}/app/access-denied`);
  }

  return {
    membership,
    profile,
    user,
  };
}
