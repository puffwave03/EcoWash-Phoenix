import { getTranslations } from "next-intl/server";
import { StaffManagement } from "@/components/staff/StaffManagement";
import {
  inviteStaffMemberAction,
  updateStaffMembershipAction,
} from "@/features/staff/server/actions";
import {
  getStaffAccess,
  listStaffMembers,
} from "@/features/staff/server/queries";

type StaffPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StaffPage({ params }: StaffPageProps) {
  const { locale } = await params;
  const [access, members, t] = await Promise.all([
    getStaffAccess(locale),
    listStaffMembers(locale),
    getTranslations({ locale, namespace: "common.staff" }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("description")}</p>
      </div>

      <StaffManagement
        actorRole={access.membership.role}
        inviteAction={inviteStaffMemberAction.bind(null, locale)}
        locale={locale}
        members={members}
        text={{
          active: t("active"),
          add: t("add"),
          configuration: t("configuration"),
          currentUser: t("currentUser"),
          deactivate: t("deactivate"),
          duplicate: t("duplicate"),
          email: t("email"),
          empty: t("empty"),
          error: t("error"),
          inactive: t("inactive"),
          invite: t("invite"),
          inviteError: t("inviteError"),
          invitedAt: t("invitedAt"),
          memberError: t("memberError"),
          name: t("name"),
          noEmail: t("noEmail"),
          pending: t("pending"),
          reactivate: t("reactivate"),
          role: t("role"),
          roles: t.raw("roles"),
          save: t("save"),
          saving: t("saving"),
          status: t("status"),
          success: t("success"),
          updateSuccess: t("updateSuccess"),
        }}
        updateAction={updateStaffMembershipAction.bind(null, locale)}
      />
    </div>
  );
}
