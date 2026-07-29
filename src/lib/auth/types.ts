export const APP_ROLES = ["owner", "manager", "staff"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type CurrentUser = {
  email: string | null;
  id: string;
};

export type CurrentProfile = {
  displayName: string;
  id: string;
  locale: string | null;
};

export type CurrentMembership = {
  id: string;
  organization: {
    id: string;
    name: string;
    status: "active" | "inactive";
    timezone: string;
  };
  role: AppRole;
};

export type DashboardAccess = {
  membership: CurrentMembership;
  profile: CurrentProfile;
  user: CurrentUser;
};

export type MembershipAccessIssue =
  | "missing_profile"
  | "no_membership"
  | "multiple_memberships"
  | "inactive_organization"
  | "invalid_role";
