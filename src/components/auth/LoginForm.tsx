"use client";

import { useActionState } from "react";
import type { LoginActionState } from "@/app/[locale]/login/actions";
import { Button } from "@/components/Button";

type LoginFormText = {
  emailLabel: string;
  emailPlaceholder: string;
  errorConfiguration: string;
  errorInvalidCredentials: string;
  errorMissingFields: string;
  passwordLabel: string;
  submit: string;
  submitting: string;
};

type LoginFormProps = {
  action: (
    state: LoginActionState,
    formData: FormData,
  ) => Promise<LoginActionState>;
  locale: string;
  text: LoginFormText;
};

const initialState: LoginActionState = {
  errorKey: null,
};

function errorMessage(errorKey: LoginActionState["errorKey"], text: LoginFormText) {
  if (errorKey === "missingFields") {
    return text.errorMissingFields;
  }

  if (errorKey === "configuration") {
    return text.errorConfiguration;
  }

  if (errorKey === "invalidCredentials") {
    return text.errorInvalidCredentials;
  }

  return null;
}

export function LoginForm({ action, locale, text }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const message = errorMessage(state.errorKey, text);

  return (
    <form action={formAction} className="space-y-5">
      <input name="locale" type="hidden" value={locale} />

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-primary" htmlFor="email">
          {text.emailLabel}
        </label>
        <input
          autoComplete="email"
          className="min-h-12 w-full rounded-control border border-border bg-white px-4 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="email"
          name="email"
          placeholder={text.emailPlaceholder}
          required
          type="email"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-primary" htmlFor="password">
          {text.passwordLabel}
        </label>
        <input
          autoComplete="current-password"
          className="min-h-12 w-full rounded-control border border-border bg-white px-4 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="password"
          name="password"
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
