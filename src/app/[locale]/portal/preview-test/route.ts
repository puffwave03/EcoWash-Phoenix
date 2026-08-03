import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/env";
import {
  verifyStagingCustomerPreviewSignature,
} from "@/features/portal/server/preview";
import { siteConfig } from "@/config/site";

type PreviewAccessRow = {
  email: string;
  is_active: boolean;
  customer: {
    display_name: string;
    email: string | null;
  } | {
    display_name: string;
    email: string | null;
  }[] | null;
};

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

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isClearlyTestCustomer(row: PreviewAccessRow) {
  const customer = relation(row.customer);
  const marker = `${row.email} ${customer?.email ?? ""} ${customer?.display_name ?? ""}`.toLowerCase();

  return marker.includes("test") || marker.includes("fixture") || marker.includes("portal");
}

function responseWithCookies(response: NextResponse, cookiesToSet: SupabaseCookie[]) {
  cookiesToSet.forEach(({ name, options, value }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

function previewClient(request: NextRequest) {
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
  const customerId = requestUrl.searchParams.get("customerId");
  const expires = requestUrl.searchParams.get("expires");
  const signature = requestUrl.searchParams.get("sig");
  const deniedUrl = new URL(`/${locale}/portal/access`, request.url);
  const { cookiesToSet, supabase } = previewClient(request);

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  if (existingUser) {
    return NextResponse.redirect(deniedUrl);
  }

  if (!verifyStagingCustomerPreviewSignature(locale, customerId, expires, signature)) {
    return NextResponse.redirect(deniedUrl);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("customer_portal_access")
    .select("email, is_active, customer:customers!customer_portal_access_customer_same_org(display_name, email)")
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<PreviewAccessRow>();

  if (error || !data || !isClearlyTestCustomer(data)) {
    return NextResponse.redirect(deniedUrl);
  }

  const redirectUrl = new URL(`/${locale}/auth/callback`, siteConfig.url);
  redirectUrl.searchParams.set("next", `/${locale}/portal`);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    email: data.email,
    options: { redirectTo: redirectUrl.toString() },
    type: "magiclink",
  });

  if (linkError || !link.properties?.action_link) {
    console.error("Customer portal staging preview link failed", linkError?.code ?? linkError?.status ?? "unknown");

    return NextResponse.redirect(deniedUrl);
  }

  const verifyResponse = await fetch(link.properties.action_link, { redirect: "manual" });
  const location = verifyResponse.headers.get("location");

  if (!location) {
    console.error("Customer portal staging preview verify failed");

    return NextResponse.redirect(deniedUrl);
  }

  const tokenParams = new URLSearchParams(new URL(location).hash.slice(1));
  const accessToken = tokenParams.get("access_token");
  const refreshToken = tokenParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    console.error("Customer portal staging preview session tokens missing");

    return NextResponse.redirect(deniedUrl);
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    console.error("Customer portal staging preview session failed");

    return responseWithCookies(NextResponse.redirect(deniedUrl), cookiesToSet);
  }

  return responseWithCookies(
    NextResponse.redirect(new URL(`/${locale}/portal`, request.url)),
    cookiesToSet,
  );
}
