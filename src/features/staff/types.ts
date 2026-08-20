import type { AppRole } from "@/lib/auth/types";
import type { OperationalCapability } from "@/lib/auth/capabilities";

export type StaffMember = {
  capabilities: OperationalCapability[];
  createdAt: string;
  email: string | null;
  id: string;
  isActive: boolean;
  isCurrentUser: boolean;
  isInvitePending: boolean;
  invitedByName: string | null;
  name: string;
  profileId: string;
  role: AppRole;
};

export type StaffEmailIntent = "access" | "reset";

export type StaffActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  success: boolean;
};
