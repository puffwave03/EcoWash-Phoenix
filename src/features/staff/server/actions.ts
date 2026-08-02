"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { getStaffAccess } from "@/features/staff/server/queries";
import type { StaffActionState } from "@/features/staff/types";
import type { AppRole } from "@/lib/auth/types";

const initialState: StaffActionState = { fieldErrors: {}, formError: null, success: false };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: AppRole[] = ["owner", "manager", "staff"];

function fail(formError: string | null = "generic", fieldErrors: Record<string, string> = {}) {
  return { fieldErrors, formError, success: false };
}

function roleFromForm(value: FormDataEntryValue | null): AppRole | null {
  const role = String(value ?? "").trim();

  return ROLES.includes(role as AppRole) ? (role as AppRole) : null;
}

function canChooseRole(actorRole: AppRole, targetRole: AppRole) {
  if (actorRole === "owner") return true;

  return actorRole === "manager" && targetRole === "staff";
}

function revalidateStaff(locale: string) {
  revalidatePath(`/${locale}/app/staff`);
}

async function existingUserIdByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });

    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 100) return null;

    page += 1;
  }

  return null;
}

export async function inviteStaffMemberAction(
  locale: string,
  _state: StaffActionState = initialState,
  formData: FormData,
) {
  void _state;

  const access = await getStaffAccess(locale);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = roleFromForm(formData.get("role"));
  const fieldErrors: Record<string, string> = {};

  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "invalid";
  if (!role || !canChooseRole(access.membership.role, role)) fieldErrors.role = "invalid";
  if (Object.keys(fieldErrors).length > 0 || !role) return fail(null, fieldErrors);

  if (!hasSupabaseAdminConfig()) return fail("configuration");

  const admin = createSupabaseAdminClient();
  let invitedUserId = await existingUserIdByEmail(email);

  if (!invitedUserId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: email.split("@")[0] },
      redirectTo: `${siteConfig.url}/${locale}/app`,
    });

    if (error || !data.user) {
      console.error("Staff invite failed", error?.code ?? error?.status ?? "unknown");
      return fail("invite");
    }

    invitedUserId = data.user.id;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_staff_membership", {
    target_profile_id: invitedUserId,
    target_role: role,
  });

  if (error) {
    console.error("Staff membership upsert failed", error.code);
    return fail(error.code === "23505" ? "duplicate" : "membership");
  }

  revalidateStaff(locale);
  return { fieldErrors: {}, formError: null, success: true };
}

export async function updateStaffMembershipAction(
  locale: string,
  membershipId: string,
  _state: StaffActionState = initialState,
  formData: FormData,
) {
  void _state;

  await getStaffAccess(locale);

  const role = roleFromForm(formData.get("role"));
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!role) return fail(null, { role: "invalid" });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_staff_membership", {
    target_is_active: isActive,
    target_membership_id: membershipId,
    target_role: role,
  });

  if (error) {
    console.error("Staff membership update failed", error.code);
    return fail("membership");
  }

  revalidateStaff(locale);
  return { fieldErrors: {}, formError: null, success: true };
}
