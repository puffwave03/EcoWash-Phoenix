"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  logoutAction,
  type LogoutActionState,
} from "@/app/[locale]/app/actions";

type LogoutButtonProps = {
  className?: string;
  errorLabel?: string;
  label: string;
  locale: string;
};

const initialState: LogoutActionState = {
  failed: false,
};

export function LogoutButton({
  className,
  errorLabel,
  label,
  locale,
}: LogoutButtonProps) {
  const [state, formAction, isPending] = useActionState(logoutAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input name="locale" type="hidden" value={locale} />
      <Button className={className} disabled={isPending} type="submit" variant="secondary">
        {label}
      </Button>
      {state.failed && errorLabel ? (
        <p className="text-sm leading-5 text-red-700" role="alert">
          {errorLabel}
        </p>
      ) : null}
    </form>
  );
}
