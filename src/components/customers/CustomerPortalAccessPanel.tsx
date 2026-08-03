"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type {
  CustomerPortalAccessSummary,
  CustomerPortalActionState,
} from "@/features/portal/types";

type CustomerPortalAccessPanelText = {
  accessDisabled: string;
  active: string;
  configurationError: string;
  disable: string;
  disabled: string;
  email: string;
  emailInvalid: string;
  enable: string;
  error: string;
  invite: string;
  invitedAt: string;
  inviteError: string;
  lastSignIn: string;
  membershipError: string;
  noLastSignIn: string;
  pending: string;
  preview: string;
  rateLimit: string;
  resend: string;
  resendSuccess: string;
  resetPassword: string;
  resetPasswordError: string;
  resetPasswordSuccess: string;
  success: string;
  title: string;
  unauthorized: string;
};

type CustomerPortalAccessPanelProps = {
  access: CustomerPortalAccessSummary | null;
  defaultEmail: string | null;
  inviteAction: (
    state: CustomerPortalActionState,
    formData: FormData,
  ) => Promise<CustomerPortalActionState>;
  locale: string;
  manageAction: (
    state: CustomerPortalActionState,
    formData: FormData,
  ) => Promise<CustomerPortalActionState>;
  previewUrl: string | null;
  text: CustomerPortalAccessPanelText;
};

const initialState: CustomerPortalActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
  successKey: null,
};

function formErrorMessage(
  error: CustomerPortalActionState["formError"],
  text: CustomerPortalAccessPanelText,
) {
  if (error === "configuration") return text.configurationError;
  if (error === "invite") return text.inviteError;
  if (error === "access") return text.membershipError;
  if (error === "unauthorized") return text.unauthorized;
  if (error === "rateLimit") return text.rateLimit;
  if (error === "accessDisabled") return text.accessDisabled;
  if (error === "resetPassword") return text.resetPasswordError;
  if (error) return text.error;

  return null;
}

function successMessage(successKey: string | null | undefined, text: CustomerPortalAccessPanelText) {
  if (successKey === "resend") return text.resendSuccess;
  if (successKey === "resetPassword") return text.resetPasswordSuccess;

  return text.success;
}

function accessStatus(access: CustomerPortalAccessSummary | null, text: CustomerPortalAccessPanelText) {
  if (!access) return text.disabled;
  if (!access.isActive) return text.accessDisabled;
  if (!access.lastSignInAt) return text.pending;

  return text.active;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CustomerPortalAccessPanel({
  access,
  defaultEmail,
  inviteAction,
  locale,
  manageAction,
  previewUrl,
  text,
}: CustomerPortalAccessPanelProps) {
  const [state, formAction, isPending] = useActionState(inviteAction, initialState);
  const [manageState, manageFormAction, isManagePending] = useActionState(
    manageAction,
    initialState,
  );
  const message = formErrorMessage(state.formError, text);
  const manageMessage = formErrorMessage(manageState.formError, text);

  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">{text.title}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            {accessStatus(access, text)}
          </p>
        </div>
        {previewUrl ? (
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-secondary bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-standard hover:bg-secondary-soft"
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            {text.preview}
          </a>
        ) : null}
      </div>

      {access ? (
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">{text.email}</dt>
            <dd className="break-words font-semibold text-primary">{access.email}</dd>
          </div>
          <div>
            <dt className="text-muted">{text.invitedAt}</dt>
            <dd className="font-semibold text-primary">{formatDate(access.invitedAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-muted">{text.lastSignIn}</dt>
            <dd className="font-semibold text-primary">
              {access.lastSignInAt ? formatDate(access.lastSignInAt, locale) : text.noLastSignIn}
            </dd>
          </div>
        </dl>
      ) : null}

      <form action={formAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.email}</span>
          <input
            className={`min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
              state.fieldErrors.email ? "border-red-300" : "border-border"
            }`}
            defaultValue={access?.email ?? defaultEmail ?? ""}
            name="email"
            type="email"
          />
        </label>
        <Button disabled={isPending} type="submit">
          {text.invite}
        </Button>
        {state.fieldErrors.email ? (
          <p className="text-sm text-red-700 sm:col-span-2">{text.emailInvalid}</p>
        ) : null}
        {message ? (
          <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">
            {message}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 sm:col-span-2">
            {successMessage(state.successKey, text)}
          </p>
        ) : null}
      </form>

      {access ? (
        <form action={manageFormAction} className="mt-5 flex flex-wrap gap-3">
          <Button disabled={isManagePending || !access.isActive} name="intent" type="submit" value="resend" variant="secondary">
            {text.resend}
          </Button>
          <Button disabled={isManagePending || !access.isActive} name="intent" type="submit" value="resetPassword" variant="secondary">
            {text.resetPassword}
          </Button>
          {access.isActive ? (
            <Button disabled={isManagePending} name="intent" type="submit" value="disable" variant="secondary">
              {text.disable}
            </Button>
          ) : (
            <Button disabled={isManagePending} name="intent" type="submit" value="enable" variant="secondary">
              {text.enable}
            </Button>
          )}
          {manageMessage ? (
            <p className="basis-full rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {manageMessage}
            </p>
          ) : null}
          {manageState.success ? (
            <p className="basis-full rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {successMessage(manageState.successKey, text)}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
