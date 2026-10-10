"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { siteConfig } from "@/config/site";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyOwnerIdentity } from "@/features/platform-admin/server/owner-identity";
import {
  normalizeTenantOnboarding, tenantOnboardingFingerprint, validateTenantOnboarding,
} from "@/features/platform-admin/tenant-onboarding-validation";
import type { TenantOnboardingError, TenantOnboardingState } from "@/features/platform-admin/types-onboarding";

const knownRpcErrors: Record<string, TenantOnboardingError> = {
  platform_admin_required: "platformAdminRequired",
  platform_tenant_bootstrap_idempotency_conflict: "idempotencyConflict",
  platform_tenant_bootstrap_slug_conflict: "slugConflict",
  platform_tenant_bootstrap_owner_membership_conflict: "ownerMembershipConflict",
  platform_tenant_bootstrap_owner_portal_conflict: "ownerPortalConflict",
  platform_tenant_bootstrap_owner_identity_invalid: "ownerIdentityInvalid",
  platform_tenant_bootstrap_input_invalid: "invalidInput",
};

function mapRpcError(message: string): TenantOnboardingError {
  return knownRpcErrors[message] ?? "unknown";
}

export async function bootstrapTenantAction(
  locale: string,
  previous: TenantOnboardingState,
  formData: FormData,
): Promise<TenantOnboardingState> {
  await requirePlatformAdmin(locale);

  const input = normalizeTenantOnboarding(formData);
  if (input.ownerMode === "invite") input.ownerId = "";
  const fingerprint = tenantOnboardingFingerprint(input);
  const key = previous.fingerprint === null || previous.fingerprint === fingerprint ? previous.key : randomUUID();
  const base: TenantOnboardingState = {
    key, fingerprint, ownerMode: input.ownerMode, fieldErrors: {}, error: null, preparedOwner: null, success: null,
  };
  const fieldErrors = validateTenantOnboarding(input);
  if (Object.keys(fieldErrors).length) return { ...base, fieldErrors };

  let ownerId = input.ownerId;
  let preparedOwner = input.ownerMode === "invite" && previous.preparedOwner?.email === input.ownerEmail
    ? previous.preparedOwner
    : null;
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin = createSupabaseAdminClient(); }
  catch { return { ...base, error: "authUnavailable" }; }

  if (input.ownerMode === "invite") {
    if (preparedOwner) {
      ownerId = preparedOwner.id;
    } else {
      const redirectUrl = new URL(`/${locale}/auth/callback`, siteConfig.url);
      redirectUrl.searchParams.set("next", `/${locale}/app`);
      try {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(input.ownerEmail, {
          redirectTo: redirectUrl.toString(),
        });
        if (error || !data.user?.id) return { ...base, error: "inviteFailed" };
        ownerId = data.user.id;
        preparedOwner = { id: ownerId, email: input.ownerEmail };
      } catch {
        return { ...base, error: "inviteFailed" };
      }
    }
  }

  const recoveryOwner = { id: ownerId, email: input.ownerEmail };
  let identity: Awaited<ReturnType<typeof verifyOwnerIdentity>>;
  try { identity = await verifyOwnerIdentity(admin, ownerId, input.ownerEmail); }
  catch { identity = "incomplete"; }
  if (identity !== "ready") {
    return {
      ...base,
      error: identity === "mismatch" ? "identityMismatch" : "identityIncomplete",
      preparedOwner: preparedOwner ?? (input.ownerMode === "existing" ? recoveryOwner : null),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("platform_bootstrap_tenant", {
      target_idempotency_key: key,
      target_name: input.name,
      target_slug: input.slug,
      target_default_currency: input.currency,
      target_timezone: input.timezone,
      target_default_locale: input.locale,
      target_default_country_code: input.country,
      target_owner_profile_id: ownerId,
      target_first_location_name: input.location,
    });
    if (error) return { ...base, error: mapRpcError(error.message), preparedOwner: recoveryOwner };
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.organization_id || !result?.organization_slug) {
      return { ...base, error: "unknown", preparedOwner: recoveryOwner };
    }
    try {
      revalidatePath(`/${locale}/platform`);
      revalidatePath(`/${locale}/platform/organizations`);
    } catch { /* The tenant is already committed; cache refresh must not reverse success. */ }
    return {
      ...base,
      preparedOwner: recoveryOwner,
      success: {
        name: input.name,
        organizationId: result.organization_id,
        slug: result.organization_slug,
        ownerId,
        ownerEmail: input.ownerEmail,
        location: input.location,
        replayed: result.replayed === true,
        invitation: input.ownerMode === "invite" ? "requested" : "existing",
      },
    };
  } catch {
    return { ...base, error: "unknown", preparedOwner: recoveryOwner };
  }
}
