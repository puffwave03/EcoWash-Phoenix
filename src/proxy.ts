import createMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);
const authPathPattern = new RegExp(
  `^/(${routing.locales.join("|")})/(app|portal|login|update-password)(/|$)`,
);
const recoveryCookieName = "ecowash-password-recovery";

type SupabaseCookie = {
  name: string;
  options: CookieOptions;
  value: string;
};

function localeFromPath(pathname: string) {
  const [, maybeLocale] = pathname.split("/");

  return routing.locales.includes(maybeLocale as (typeof routing.locales)[number])
    ? maybeLocale
    : routing.defaultLocale;
}

function copySupabaseCookies(
  response: NextResponse,
  cookiesToSet: SupabaseCookie[],
) {
  cookiesToSet.forEach(({ name, options, value }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!authPathPattern.test(pathname)) {
    return handleI18nRouting(request);
  }

  const locale = localeFromPath(pathname);
  let response = handleI18nRouting(request);
  let cookiesToSet: SupabaseCookie[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookiesToSet) {
        cookiesToSet = nextCookiesToSet;
        nextCookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = copySupabaseCookies(handleI18nRouting(request), cookiesToSet);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAppRoute = new RegExp(`^/${locale}/app(/|$)`).test(pathname);
  const isLoginRoute = pathname === `/${locale}/login`;
  const isPortalRoute = new RegExp(`^/${locale}/portal(/|$)`).test(pathname);
  const isPortalPreviewRoute = pathname === `/${locale}/portal/preview-test`;
  const isUpdatePasswordRoute = pathname === `/${locale}/update-password`;

  if (isUpdatePasswordRoute && request.nextUrl.searchParams.has("code")) {
    const code = request.nextUrl.searchParams.get("code");
    const cleanUrl = new URL(`/${locale}/update-password`, request.url);

    if (!code) {
      cleanUrl.searchParams.set("error", "recovery");

      return copySupabaseCookies(NextResponse.redirect(cleanUrl), cookiesToSet);
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      cleanUrl.searchParams.set("error", "recovery");
    }

    const redirectResponse = copySupabaseCookies(NextResponse.redirect(cleanUrl), cookiesToSet);

    if (!error) {
      redirectResponse.cookies.set(recoveryCookieName, "1", {
        httpOnly: true,
        maxAge: 15 * 60,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      });
    }

    return redirectResponse;
  }

  if ((isAppRoute || (isPortalRoute && !isPortalPreviewRoute)) && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);

    return copySupabaseCookies(NextResponse.redirect(loginUrl), cookiesToSet);
  }

  if (isLoginRoute && user) {
    const { data: portalAccess } = await supabase
      .from("customer_portal_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);
    const appUrl = new URL(
      portalAccess && portalAccess.length > 0 ? `/${locale}/portal` : `/${locale}/app`,
      request.url,
    );

    return copySupabaseCookies(NextResponse.redirect(appUrl), cookiesToSet);
  }

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
