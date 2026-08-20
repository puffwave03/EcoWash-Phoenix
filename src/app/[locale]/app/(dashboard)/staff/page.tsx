import { getTranslations } from "next-intl/server";
import { StaffManagement } from "@/components/staff/StaffManagement";
import {
  inviteStaffMemberAction,
  sendStaffAccessEmailAction,
  updateStaffCapabilitiesAction,
  updateStaffMembershipAction,
} from "@/features/staff/server/actions";
import {
  listStaffMembers,
} from "@/features/staff/server/queries";

type StaffPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StaffPage({ params }: StaffPageProps) {
  const { locale } = await params;
  const [members, t] = await Promise.all([
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
        capabilityAction={updateStaffCapabilitiesAction.bind(null, locale)}
        emailAction={sendStaffAccessEmailAction.bind(null, locale)}
        inviteAction={inviteStaffMemberAction.bind(null, locale)}
        locale={locale}
        members={members}
        text={{
          active: t("active"),
          accessLink: t("accessLink"),
          add: t("add"),
          authUnavailable: t("authUnavailable"),
          capabilities: t("capabilities"),
          capabilitiesDescription: t("capabilitiesDescription"),
          capabilitiesError: t("capabilitiesError"),
          capabilitiesSaved: t("capabilitiesSaved"),
          capabilityLabels: t.raw("capabilityLabels"),
          configuration: t("configuration"),
          confirmDeactivate: t("confirmDeactivate"),
          currentUser: t("currentUser"),
          deactivate: t("deactivate"),
          duplicate: t("duplicate"),
          email: t("email"),
          emailActionError: t("emailActionError"),
          emailSent: t("emailSent"),
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
          resetPassword: t("resetPassword"),
          role: t("role"),
          roleManagedCapabilities: t("roleManagedCapabilities"),
          roles: t.raw("roles"),
          save: t("save"),
          saveCapabilities: t("saveCapabilities"),
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
