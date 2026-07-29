"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";
import { requestPasswordResetAction } from "@/app/[locale]/forgot-password/actions";

type ForgotPasswordFormText = {
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  submitting: string;
};

type ForgotPasswordFormProps = {
  locale: string;
  text: ForgotPasswordFormText;
};

function SubmitButton({ text }: { text: ForgotPasswordFormText }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? text.submitting : text.submit}
    </Button>
  );
}

export function ForgotPasswordForm({ locale, text }: ForgotPasswordFormProps) {
  return (
    <form action={requestPasswordResetAction} className="space-y-5">
      <input name="locale" type="hidden" value={locale} />

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-primary" htmlFor="reset-email">
          {text.emailLabel}
        </label>
        <input
          autoComplete="email"
          className="min-h-12 w-full rounded-control border border-border bg-white px-4 text-base text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          id="reset-email"
          name="email"
          placeholder={text.emailPlaceholder}
          required
          type="email"
        />
      </div>

      <SubmitButton text={text} />
    </form>
  );
}
