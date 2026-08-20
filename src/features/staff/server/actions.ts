"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { getStaffAccess } from "@/features/staff/server/queries";
import type { StaffActionState, StaffEmailIntent } from "@/features/staff/types";
import {
  OPERATIONAL_CAPABILITIES,
  STAFF_OPERATIONAL_CAPABILITIES,
  isOperationalCapability,
} from "@/lib/auth/capabilities";
import type { OperationalCapability } from "@/lib/auth/capabilities";
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

function capabilitiesFromForm(formData: FormData): OperationalCapability[] {
  return STAFF_OPERATIONAL_CAPABILITIES.filter((capability) =>
    formData.getAll("capabilities").some((value) => value === capability),
  );
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

  await getStaffAccess(locale);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const role = roleFromForm(formData.get("role"));
  const capabilities = capabilitiesFromForm(formData);
  const fieldErrors: Record<string, string> = {};

  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "invalid";
  if (!role) fieldErrors.role = "invalid";
  if (Object.keys(fieldErrors).length > 0 || !role) return fail(null, fieldErrors);

  if (!hasSupabaseAdminConfig()) return fail("configuration");

  const admin = createSupabaseAdminClient();
  let invitedUserId = await existingUserIdByEmail(email);

  if (!invitedUserId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: name || email.split("@")[0] },
      redirectTo: `${siteConfig.url}/${locale}/app`,
    });

    if (error || !data.user) {
      console.error("Staff invite failed", error?.code ?? error?.status ?? "unknown");
      return fail("invite");
    }

    invitedUserId = data.user.id;
  }

  const supabase = await createSupabaseServerClient();
  const { data: membershipId, error } = await supabase.rpc("upsert_staff_membership", {
    target_profile_id: invitedUserId,
    target_role: role,
  });

  if (error || !membershipId) {
    console.error("Staff membership upsert failed", error?.code ?? "missing_result");
    return fail(error?.code === "23505" ? "duplicate" : "membership");
  }

  const selectedCapabilities = role === "staff"
    ? capabilities
    : [...OPERATIONAL_CAPABILITIES];
  const { error: capabilitiesError } = await supabase.rpc("update_staff_capabilities", {
    target_capabilities: selectedCapabilities,
    target_membership_id: String(membershipId),
  });

  if (capabilitiesError) {
    console.error("Staff capabilities update failed", capabilitiesError.code);
    return fail("capabilities");
  }

  revalidateStaff(locale);
  return { fieldErrors: {}, formError: null, success: true };
}

export async function updateStaffCapabilitiesAction(
  locale: string,
  membershipId: string,
  _state: StaffActionState = initialState,
  formData: FormData,
) {
  void _state;

  await getStaffAccess(locale);
  const capabilities = capabilitiesFromForm(formData);
  const invalidCapability = formData
    .getAll("capabilities")
    .some((value) => !isOperationalCapability(String(value)) || value === "supervision");

  if (invalidCapability) return fail("capabilities");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_staff_capabilities", {
    target_capabilities: capabilities,
    target_membership_id: membershipId,
  });

  if (error) {
    console.error("Staff capabilities update failed", error.code);
    return fail("capabilities");
  }

  revalidateStaff(locale);
  return { fieldErrors: {}, formError: null, success: true };
}

export async function sendStaffAccessEmailAction(
  locale: string,
  membershipId: string,
  intent: StaffEmailIntent,
  _state: StaffActionState = initialState,
  _formData: FormData,
) {
  void _state;
  void _formData;

  const access = await getStaffAccess(locale);
  if (!hasSupabaseAdminConfig()) return fail("configuration");
  if (!(["access", "reset"] as StaffEmailIntent[]).includes(intent)) return fail("emailAction");

  const supabase = await createSupabaseServerClient();
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("profile_id")
    .eq("id", membershipId)
    .eq("organization_id", access.membership.organization.id)
    .maybeSingle<{ profile_id: string }>();

  if (membershipError || !membership) return fail("membership");

  const admin = createSupabaseAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(
    membership.profile_id,
  );
  const email = userData.user?.email;

  if (userError || !email) return fail("emailAction");

  const redirectUrl = new URL(`/${locale}/auth/callback`, siteConfig.url);
  redirectUrl.searchParams.set(
    "next",
    intent === "reset" ? `/${locale}/update-password` : `/${locale}/app`,
  );
  const { error } = intent === "reset"
    ? await admin.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() })
    : await admin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl.toString(), shouldCreateUser: false },
      });

  if (error) {
    console.error("Staff access email failed", error.code ?? error.status ?? "unknown");
    return fail("emailAction");
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
