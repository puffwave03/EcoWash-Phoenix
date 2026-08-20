"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  StaffActionState,
  StaffEmailIntent,
  StaffMember,
} from "@/features/staff/types";
import {
  OPERATIONAL_CAPABILITIES,
  STAFF_OPERATIONAL_CAPABILITIES,
} from "@/lib/auth/capabilities";
import type { OperationalCapability } from "@/lib/auth/capabilities";
import type { AppRole } from "@/lib/auth/types";

type StaffText = {
  accessLink: string;
  active: string;
  add: string;
  authUnavailable: string;
  capabilities: string;
  capabilitiesDescription: string;
  capabilitiesError: string;
  capabilitiesSaved: string;
  capabilityLabels: Record<OperationalCapability, string>;
  configuration: string;
  confirmDeactivate: string;
  currentUser: string;
  deactivate: string;
  duplicate: string;
  email: string;
  emailActionError: string;
  emailSent: string;
  empty: string;
  error: string;
  inactive: string;
  invite: string;
  inviteError: string;
  invitedAt: string;
  memberError: string;
  name: string;
  noEmail: string;
  pending: string;
  reactivate: string;
  resetPassword: string;
  role: string;
  roleManagedCapabilities: string;
  roles: Record<AppRole, string>;
  save: string;
  saveCapabilities: string;
  saving: string;
  status: string;
  success: string;
  updateSuccess: string;
};

const initialState: StaffActionState = { fieldErrors: {}, formError: null, success: false };
const roleOptions: AppRole[] = ["owner", "manager", "staff"];

function errorText(error: string | null, text: StaffText) {
  if (error === "authUnavailable") return text.authUnavailable;
  if (error === "configuration") return text.configuration;
  if (error === "duplicate") return text.duplicate;
  if (error === "invite") return text.inviteError;
  if (error === "membership") return text.memberError;
  if (error === "capabilities") return text.capabilitiesError;
  if (error === "emailAction") return text.emailActionError;
  if (error) return text.error;

  return null;
}

function CapabilityFields({
  defaultCapabilities = STAFF_OPERATIONAL_CAPABILITIES,
  text,
}: {
  defaultCapabilities?: readonly OperationalCapability[];
  text: StaffText;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-primary">{text.capabilities}</legend>
      <p className="text-xs leading-5 text-muted">{text.capabilitiesDescription}</p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {STAFF_OPERATIONAL_CAPABILITIES.map((capability) => (
          <label
            className="flex min-h-11 items-center gap-2 rounded-control border border-border bg-white px-3 text-sm font-medium text-primary"
            key={capability}
          >
            <input
              defaultChecked={defaultCapabilities.includes(capability)}
              name="capabilities"
              type="checkbox"
              value={capability}
            />
            <span>{text.capabilityLabels[capability]}</span>
          </label>
        ))}
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-dashed border-border bg-[#f7f8f7] px-3 text-sm text-muted">
          <span>{text.capabilityLabels.supervision}</span>
          <span className="text-xs font-semibold">{text.roleManagedCapabilities}</span>
        </div>
      </div>
    </fieldset>
  );
}

function InviteForm({
  action,
  text,
}: {
  action: (state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  text: StaffText;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const message = errorText(state.formError, text);

  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">{text.add}</h3>
      {message ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
      {state.success ? <p className="rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{text.success}</p> : null}
      <form action={formAction} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{text.name}</span>
            <input className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm" name="name" type="text" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{text.email}</span>
            <input
              className={`min-h-11 w-full rounded-control border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${state.fieldErrors.email ? "border-red-300" : "border-border"}`}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{text.role}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm" defaultValue="staff" name="role">
              {roleOptions.map((role) => <option key={role} value={role}>{text.roles[role]}</option>)}
            </select>
          </label>
        </div>
        <CapabilityFields text={text} />
        <Button className="w-full sm:w-auto" disabled={isPending} type="submit">
          {isPending ? text.saving : text.invite}
        </Button>
      </form>
    </Card>
  );
}

function EmailAction({
  action,
  intent,
  label,
  text,
}: {
  action: (intent: StaffEmailIntent, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  intent: StaffEmailIntent;
  label: string;
  text: StaffText;
}) {
  const [state, formAction, isPending] = useActionState(action.bind(null, intent), initialState);

  return (
    <form action={formAction} className="space-y-2">
      <Button className="w-full" disabled={isPending} type="submit" variant="ghost">
        {isPending ? text.saving : label}
      </Button>
      {state.formError ? <p className="text-xs text-red-700">{errorText(state.formError, text)}</p> : null}
      {state.success ? <p className="text-xs font-medium text-green-700">{text.emailSent}</p> : null}
    </form>
  );
}

function MemberCard({
  capabilityAction,
  emailAction,
  locale,
  member,
  membershipAction,
  text,
}: {
  capabilityAction: (membershipId: string, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  emailAction: (membershipId: string, intent: StaffEmailIntent, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  locale: string;
  member: StaffMember;
  membershipAction: (membershipId: string, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  text: StaffText;
}) {
  const [membershipState, membershipFormAction, isMembershipPending] = useActionState(membershipAction.bind(null, member.id), initialState);
  const [statusState, statusAction, isStatusPending] = useActionState(membershipAction.bind(null, member.id), initialState);
  const [capabilityState, capabilityFormAction, isCapabilityPending] = useActionState(capabilityAction.bind(null, member.id), initialState);
  const manageable = !member.isCurrentUser;
  const message = errorText(membershipState.formError ?? statusState.formError, text);

  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-primary">{member.name}</h3>
            {member.isCurrentUser ? <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{text.currentUser}</span> : null}
            {member.isInvitePending ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{text.pending}</span> : null}
          </div>
          <p className="mt-1 truncate text-sm text-muted">{member.email ?? text.noEmail}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${member.isActive ? "bg-green-50 text-green-700" : "bg-[#eef1ee] text-muted"}`}>
          {member.isActive ? text.active : text.inactive}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-primary">{text.role}</dt>
          <dd className="text-muted">{text.roles[member.role]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.invitedAt}</dt>
          <dd className="text-muted">{new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(member.createdAt))}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-sm font-semibold text-primary">{text.capabilities}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OPERATIONAL_CAPABILITIES.map((capability) => (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                member.capabilities.includes(capability)
                  ? "border-primary/20 bg-primary-soft text-primary"
                  : "border-border bg-white text-muted"
              }`}
              key={capability}
            >
              {text.capabilityLabels[capability]}
            </span>
          ))}
        </div>
      </div>

      {manageable ? (
        <div className="mt-5 grid gap-4 border-t border-border pt-4 xl:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-4">
            {member.role === "staff" ? (
              <form action={capabilityFormAction} className="space-y-3">
                <CapabilityFields defaultCapabilities={member.capabilities} text={text} />
                <Button disabled={isCapabilityPending} type="submit" variant="secondary">
                  {isCapabilityPending ? text.saving : text.saveCapabilities}
                </Button>
                {capabilityState.formError ? <p className="text-sm text-red-700">{errorText(capabilityState.formError, text)}</p> : null}
                {capabilityState.success ? <p className="text-sm font-medium text-green-700">{text.capabilitiesSaved}</p> : null}
              </form>
            ) : (
              <p className="rounded-control bg-[#f7f8f7] px-3 py-2 text-sm text-muted">{text.roleManagedCapabilities}</p>
            )}

            <form action={membershipFormAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="space-y-2 text-sm font-semibold text-primary">
                <span>{text.role}</span>
                <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm" defaultValue={member.role} name="role">
                  {roleOptions.map((role) => <option key={role} value={role}>{text.roles[role]}</option>)}
                </select>
              </label>
              <input name="isActive" type="hidden" value={member.isActive ? "true" : "false"} />
              <div className="flex items-end">
                <Button className="w-full" disabled={isMembershipPending} type="submit" variant="secondary">
                  {isMembershipPending ? text.saving : text.save}
                </Button>
              </div>
            </form>

            <form
              action={statusAction}
              onSubmit={(event) => {
                if (member.isActive && !window.confirm(text.confirmDeactivate)) event.preventDefault();
              }}
            >
              <input name="role" type="hidden" value={member.role} />
              <input name="isActive" type="hidden" value={member.isActive ? "false" : "true"} />
              <Button className="w-full sm:w-auto" disabled={isStatusPending} type="submit" variant={member.isActive ? "secondary" : "primary"}>
                {isStatusPending ? text.saving : member.isActive ? text.deactivate : text.reactivate}
              </Button>
            </form>
            {message ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
            {membershipState.success || statusState.success ? <p className="text-sm font-medium text-green-700">{text.updateSuccess}</p> : null}
          </div>

          {member.email ? (
            <div className="space-y-2 rounded-control border border-border bg-[#f7f8f7] p-3">
              <EmailAction action={emailAction.bind(null, member.id)} intent="access" label={text.accessLink} text={text} />
              <EmailAction action={emailAction.bind(null, member.id)} intent="reset" label={text.resetPassword} text={text} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function StaffManagement({
  capabilityAction,
  emailAction,
  inviteAction,
  locale,
  members,
  text,
  updateAction,
}: {
  capabilityAction: (membershipId: string, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  emailAction: (membershipId: string, intent: StaffEmailIntent, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  inviteAction: (state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  locale: string;
  members: StaffMember[];
  text: StaffText;
  updateAction: (membershipId: string, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
}) {
  const activeMembers = members.filter((member) => member.isActive);
  const inactiveMembers = members.filter((member) => !member.isActive);

  return (
    <div className="space-y-6">
      <InviteForm action={inviteAction} text={text} />

      {[
        { members: activeMembers, title: text.active },
        { members: inactiveMembers, title: text.inactive },
      ].map((section) => (
        <section className="space-y-3" key={section.title}>
          <h3 className="text-xl font-semibold text-primary">{section.title}</h3>
          {section.members.length === 0 ? (
            <Card><p className="text-sm text-muted">{text.empty}</p></Card>
          ) : (
            <div className="space-y-3">
              {section.members.map((member) => (
                <MemberCard
                  capabilityAction={capabilityAction}
                  emailAction={emailAction}
                  key={member.id}
                  locale={locale}
                  member={member}
                  membershipAction={updateAction}
                  text={text}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
