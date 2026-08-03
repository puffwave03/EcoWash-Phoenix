import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { getSupabaseConfig } from "@/lib/supabase/env";

const recoveryCookieName = "ecowash-password-recovery";

type SupabaseCookie = {
  name: string;
  options: CookieOptions;
  value: string;
};

function safeLocale(value: string) {
  return routing.locales.includes(value as (typeof routing.locales)[number])
    ? value
    : routing.defaultLocale;
}

function safeRedirectPath(locale: string, value: string | null) {
  const fallback = `/${locale}/portal`;

  if (!value?.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;

  const allowedPrefixes = [
    `/${locale}/portal`,
    `/${locale}/app`,
    `/${locale}/update-password`,
  ];

  return allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))
    ? value
    : fallback;
}

function responseWithCookies(response: NextResponse, cookiesToSet: SupabaseCookie[]) {
  cookiesToSet.forEach(({ name, options, value }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

function markRecoverySession(
  response: NextResponse,
  request: NextRequest,
  nextPath: string,
) {
  if (!nextPath.endsWith("/update-password")) return response;

  response.cookies.set(recoveryCookieName, "1", {
    httpOnly: true,
    maxAge: 15 * 60,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}

function callbackBridgeHtml(locale: string, nextPath: string) {
  const loginPath = `/${locale}/login?status=authCallbackError`;

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex,nofollow" />
    <title>EcoWash Phoenix</title>
  </head>
  <body>
    <p>Completing secure sign-in...</p>
    <noscript>
      <p>This sign-in link requires JavaScript. Please enable JavaScript and open the link again.</p>
    </noscript>
    <script>
      (async function () {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken || !refreshToken) {
          window.location.replace(${JSON.stringify(loginPath)});
          return;
        }

        try {
          const response = await fetch(window.location.pathname + window.location.search, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              next: ${JSON.stringify(nextPath)}
            })
          });
          const payload = await response.json();
          window.location.replace(payload.redirectTo || ${JSON.stringify(loginPath)});
        } catch {
          window.location.replace(${JSON.stringify(loginPath)});
        }
      })();
    </script>
  </body>
</html>`;
}

function createCallbackClient(request: NextRequest) {
  const cookiesToSet: SupabaseCookie[] = [];
  const { anonKey, url } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookiesToSet) {
        cookiesToSet.splice(0, cookiesToSet.length, ...nextCookiesToSet);
      },
    },
  });

  return { cookiesToSet, supabase };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await params;
  const locale = safeLocale(rawLocale);
  const requestUrl = new URL(request.url);
  const nextPath = safeRedirectPath(locale, requestUrl.searchParams.get("next"));
  const successUrl = new URL(nextPath, request.url);
  const errorUrl = new URL(`/${locale}/login`, request.url);
  errorUrl.searchParams.set("status", "authCallbackError");

  const { cookiesToSet, supabase } = createCallbackClient(request);

  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  let error: unknown = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    }));
  } else {
    return new NextResponse(callbackBridgeHtml(locale, nextPath), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (error) {
    console.error("Auth callback failed");

    return responseWithCookies(NextResponse.redirect(errorUrl), cookiesToSet);
  }

  return markRecoverySession(
    responseWithCookies(NextResponse.redirect(successUrl), cookiesToSet),
    request,
    nextPath,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await params;
  const locale = safeLocale(rawLocale);
  const requestUrl = new URL(request.url);
  const errorUrl = new URL(`/${locale}/login`, request.url);
  errorUrl.searchParams.set("status", "authCallbackError");

  let body: {
    access_token?: string;
    next?: string;
    refresh_token?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ redirectTo: errorUrl.pathname + errorUrl.search }, { status: 400 });
  }

  const nextPath = safeRedirectPath(locale, body.next ?? requestUrl.searchParams.get("next"));
  const { cookiesToSet, supabase } = createCallbackClient(request);

  if (!body.access_token || !body.refresh_token) {
    return NextResponse.json({ redirectTo: errorUrl.pathname + errorUrl.search }, { status: 400 });
  }

  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });

  if (error) {
    console.error("Auth callback session persistence failed");

    return responseWithCookies(
      NextResponse.json({ redirectTo: errorUrl.pathname + errorUrl.search }, { status: 400 }),
      cookiesToSet,
    );
  }

  return markRecoverySession(
    responseWithCookies(NextResponse.json({ redirectTo: nextPath }), cookiesToSet),
    request,
    nextPath,
  );
}
