import type { AppRole } from "@/lib/auth/types";

export type StaffMember = {
  createdAt: string;
  email: string | null;
  id: string;
  isActive: boolean;
  isCurrentUser: boolean;
  invitedByName: string | null;
  name: string;
  profileId: string;
  role: AppRole;
};

export type StaffActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  success: boolean;
};
