import { Button } from "@/components/Button";
import { logoutAction } from "@/app/[locale]/app/actions";

type LogoutButtonProps = {
  label: string;
  locale: string;
};

export function LogoutButton({ label, locale }: LogoutButtonProps) {
  return (
    <form action={logoutAction}>
      <input name="locale" type="hidden" value={locale} />
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </form>
  );
}
