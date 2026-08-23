import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

type CustomerPortalShellText = {
  logout: string;
  navigationLabel: string;
  newRequest?: string;
  orders: string;
  overview: string;
  title: string;
};

type CustomerPortalShellProps = {
  children: ReactNode;
  customerName?: string;
  locale: string;
  text: CustomerPortalShellText;
};

export function CustomerPortalShell({
  children,
  customerName,
  locale,
  text,
}: CustomerPortalShellProps) {
  return (
    <main className="min-h-screen bg-[#eef1ee] text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
              {text.title}
            </p>
            {customerName ? (
              <h1 className="mt-1 text-xl font-semibold text-primary">{customerName}</h1>
            ) : null}
          </div>
          <nav aria-label={text.navigationLabel} className="flex flex-wrap items-center gap-2">
            {text.newRequest ? (
              <Link
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 text-sm font-semibold text-white transition-standard hover:bg-primary-strong"
                href="/portal/requests/new"
                locale={locale}
              >
                {text.newRequest}
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary-soft"
              href="/portal"
              locale={locale}
            >
              {text.overview}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary-soft"
              href="/portal/orders"
              locale={locale}
            >
              {text.orders}
            </Link>
            <LogoutButton label={text.logout} locale={locale} />
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">{children}</section>
    </main>
  );
}
