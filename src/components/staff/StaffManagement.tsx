"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { StaffActionState, StaffMember } from "@/features/staff/types";
import type { AppRole } from "@/lib/auth/types";

type StaffText = {
  active: string;
  add: string;
  configuration: string;
  currentUser: string;
  deactivate: string;
  duplicate: string;
  email: string;
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
  role: string;
  roles: Record<AppRole, string>;
  save: string;
  saving: string;
  status: string;
  success: string;
  updateSuccess: string;
};

const initialState: StaffActionState = { fieldErrors: {}, formError: null, success: false };

function roleOptions(actorRole: AppRole) {
  return actorRole === "owner" ? ["owner", "manager", "staff"] as AppRole[] : ["staff"] as AppRole[];
}

function canManage(actorRole: AppRole, member: StaffMember) {
  if (member.isCurrentUser) return false;
  if (actorRole === "owner") return true;

  return actorRole === "manager" && member.role === "staff";
}

function errorText(error: string | null, text: StaffText) {
  if (error === "configuration") return text.configuration;
  if (error === "duplicate") return text.duplicate;
  if (error === "invite") return text.inviteError;
  if (error === "membership") return text.memberError;
  if (error) return text.error;

  return null;
}

function InviteForm({
  action,
  actorRole,
  text,
}: {
  action: (state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  actorRole: AppRole;
  text: StaffText;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const message = errorText(state.formError, text);

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-primary">{text.add}</h3>
      </div>
      {message ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
      {state.success ? <p className="rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{text.success}</p> : null}
      <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_12rem_auto]">
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.email}</span>
          <input
            className={`min-h-11 w-full rounded-control border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${state.fieldErrors.email ? "border-red-300" : "border-border"}`}
            name="email"
            type="email"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.role}</span>
          <select
            className={`min-h-11 w-full rounded-control border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${state.fieldErrors.role ? "border-red-300" : "border-border"}`}
            name="role"
          >
            {roleOptions(actorRole).map((role) => (
              <option key={role} value={role}>{text.roles[role]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button disabled={isPending} type="submit">{isPending ? text.saving : text.invite}</Button>
        </div>
      </form>
    </Card>
  );
}

function MemberCard({
  actorRole,
  locale,
  member,
  onUpdate,
  text,
}: {
  actorRole: AppRole;
  locale: string;
  member: StaffMember;
  onUpdate: (membershipId: string, state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  text: StaffText;
}) {
  const [state, formAction, isPending] = useActionState(onUpdate.bind(null, member.id), initialState);
  const [statusState, statusAction, isStatusPending] = useActionState(onUpdate.bind(null, member.id), initialState);
  const manageable = canManage(actorRole, member);
  const message = errorText(state.formError ?? statusState.formError, text);

  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-primary">{member.name}</h3>
              {member.isCurrentUser ? (
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{text.currentUser}</span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-muted">{member.email ?? text.noEmail}</p>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-primary">{text.role}</dt>
              <dd className="text-muted">{text.roles[member.role]}</dd>
            </div>
            <div>
              <dt className="font-semibold text-primary">{text.status}</dt>
              <dd className={member.isActive ? "text-primary" : "text-muted"}>{member.isActive ? text.active : text.inactive}</dd>
            </div>
            <div>
              <dt className="font-semibold text-primary">{text.invitedAt}</dt>
              <dd className="text-muted">{new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(member.createdAt))}</dd>
            </div>
          </dl>
        </div>

        {manageable ? (
          <div className="grid min-w-0 gap-3 lg:min-w-[24rem]">
            <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="space-y-2 text-sm font-semibold text-primary">
                <span>{text.role}</span>
                <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm" defaultValue={member.role} name="role">
                  {roleOptions(actorRole).map((role) => (
                    <option key={role} value={role}>{text.roles[role]}</option>
                  ))}
                </select>
              </label>
              <input name="isActive" type="hidden" value={member.isActive ? "true" : "false"} />
              <div className="flex items-end">
                <Button className="w-full" disabled={isPending} type="submit" variant="secondary">
                  {isPending ? text.saving : text.save}
                </Button>
              </div>
            </form>
            <form action={statusAction}>
              <input name="role" type="hidden" value={member.role} />
              <input name="isActive" type="hidden" value={member.isActive ? "false" : "true"} />
              <Button className="w-full" disabled={isStatusPending} type="submit" variant={member.isActive ? "secondary" : "primary"}>
                {isStatusPending ? text.saving : member.isActive ? text.deactivate : text.reactivate}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
      {message ? <p className="mt-3 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
      {state.success || statusState.success ? <p className="mt-3 rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{text.updateSuccess}</p> : null}
    </article>
  );
}

export function StaffManagement({
  actorRole,
  inviteAction,
  locale,
  members,
  text,
  updateAction,
}: {
  actorRole: AppRole;
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
      <InviteForm action={inviteAction} actorRole={actorRole} text={text} />

      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-primary">{text.active}</h3>
        {activeMembers.length === 0 ? (
          <Card><p className="text-sm text-muted">{text.empty}</p></Card>
        ) : (
          <div className="space-y-3">
            {activeMembers.map((member) => (
              <MemberCard actorRole={actorRole} key={member.id} locale={locale} member={member} onUpdate={updateAction} text={text} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-primary">{text.inactive}</h3>
        {inactiveMembers.length === 0 ? (
          <Card><p className="text-sm text-muted">{text.empty}</p></Card>
        ) : (
          <div className="space-y-3">
            {inactiveMembers.map((member) => (
              <MemberCard actorRole={actorRole} key={member.id} locale={locale} member={member} onUpdate={updateAction} text={text} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
