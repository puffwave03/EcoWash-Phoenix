"use client";

import { useActionState } from "react";
import { updatePasswordAction, type UpdatePasswordActionState } from "@/app/[locale]/update-password/actions";
import { Button } from "@/components/Button";

type UpdatePasswordFormText = {
  confirmPasswordLabel: string;
  errorConfiguration: string;
  errorExpired: string;
  errorMissingFields: string;
  errorMismatch: string;
  errorUpdateFailed: string;
  errorWeakPassword: string;
  passwordHelp: string;
  passwordLabel: string;
  submit: string;
  submitting: string;
};

type UpdatePasswordFormProps = {
  locale: string;
  text: UpdatePasswordFormText;
};

const initialState: UpdatePasswordActionState = {
  errorKey: null,
};

function errorMessage(errorKey: UpdatePasswordActionState["errorKey"], text: UpdatePasswordFormText) {
  if (errorKey === "missingFields") return text.errorMissingFields;
  if (errorKey === "mismatch") return text.errorMismatch;
  if (errorKey === "weakPassword") return text.errorWeakPassword;
  if (errorKey === "expired") return text.errorExpired;
  if (errorKey === "configuration") return text.errorConfiguration;
  if (errorKey === "updateFailed") return text.errorUpdateFailed;

  return null;
}

export function UpdatePasswordForm({ locale, text }: UpdatePasswordFormProps) {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialState);
  const message = errorMessage(state.errorKey, text);

  return (
    <form action={formAction} className="space-y-5">
      <input name="locale" type="hidden" value={locale} />

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-primary" htmlFor="new-password">
          {text.passwordLabel}
        </label>
        <input
          autoComplete="new-password"
          className="min-h-12 w-full rounded-control border border-border bg-white px-4 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="new-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="text-sm leading-6 text-muted">{text.passwordHelp}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-primary" htmlFor="confirm-password">
          {text.confirmPasswordLabel}
        </label>
        <input
          autoComplete="new-password"
          className="min-h-12 w-full rounded-control border border-border bg-white px-4 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="confirm-password"
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
      </div>

      {message ? (
        <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? text.submitting : text.submit}
      </Button>
    </form>
  );
}
