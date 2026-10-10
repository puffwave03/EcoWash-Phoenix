import type { OwnerMode, TenantOnboardingFieldErrors } from "@/features/platform-admin/tenant-onboarding-validation";

export type TenantOnboardingError =
  | "authUnavailable" | "inviteFailed" | "identityIncomplete" | "identityMismatch"
  | "platformAdminRequired" | "idempotencyConflict" | "slugConflict"
  | "ownerMembershipConflict" | "ownerPortalConflict" | "ownerIdentityInvalid"
  | "invalidInput" | "unknown";

export type TenantOnboardingState = {
  key: string;
  fingerprint: string | null;
  ownerMode: OwnerMode;
  fieldErrors: TenantOnboardingFieldErrors;
  error: TenantOnboardingError | null;
  preparedOwner: { id: string; email: string } | null;
  success: null | {
    name: string;
    organizationId: string;
    slug: string;
    ownerId: string;
    ownerEmail: string;
    location: string;
    replayed: boolean;
    invitation: "requested" | "existing";
  };
};
