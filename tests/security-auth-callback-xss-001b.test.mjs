import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/app/[locale]/auth/callback/route.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const locales = ["en", "it", "es", "fr", "de"];

// Only synthetic values and local doubles: no Auth, network or database calls.
function harness({ authError = null } = {}) {
  const calls = [];
  class NextResponse extends Response {
    cookies = { values: [], set: (...args) => this.cookies.values.push(args) };
    static redirect(url) { return new NextResponse(null, { status: 307, headers: { location: String(url) } }); }
    static json(value, init) {
      return new NextResponse(JSON.stringify(value), { ...init, headers: { "content-type": "application/json" } });
    }
  }
  const mocks = {
    "next/server": { NextResponse },
    "@/i18n/routing": { routing: { locales, defaultLocale: "en" } },
    "@/lib/supabase/env": { getSupabaseConfig: () => ({ anonKey: "synthetic", url: "https://example.test" }) },
    "@supabase/ssr": {
      createServerClient(_url, _key, options) {
        return { auth: Object.fromEntries(["exchangeCodeForSession", "verifyOtp", "setSession", "signOut"].map(name => [
          name, async value => {
            calls.push({ name, value });
            options.cookies.setAll([{ name: "synthetic-session", value: "synthetic", options: { httpOnly: true } }]);
            return { error: name === "signOut" ? null : authError };
          },
        ])) };
      },
    },
  };
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, URL,
    console: { error() {} },
    require(name) { assert.ok(name in mocks, name); return mocks[name]; },
  });
  function request({ next, body, code, tokenHash, type, invalidJson = false } = {}) {
    const url = new URL("https://example.test/es/auth/callback");
    for (const [key, value] of Object.entries({ next, code, token_hash: tokenHash, type })) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return { url: String(url), nextUrl: url, cookies: { getAll: () => [] }, json: async () => {
      if (invalidJson) throw new SyntaxError("synthetic invalid JSON");
      return body;
    } };
  }
  return {
    calls,
    get: (input, locale = "es") => testModule.exports.GET(request(input), { params: Promise.resolve({ locale }) }),
    post: (input, locale = "es") => testModule.exports.POST(request(input), { params: Promise.resolve({ locale }) }),
  };
}

function bridgeScript(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  assert.equal(scripts.length, 1, "exactly the intended script element must exist");
  // Every '<' in this script would come from interpolated data. Its absence
  // rules out end tags, injected elements and HTML script escaped-state changes.
  assert.doesNotMatch(scripts[0][1], /</);
  return scripts[0][1];
}

async function runBridge(script, { fetchError = false, redirectTo } = {}) {
  let submitted;
  let destination;
  await vm.runInNewContext(script, {
    URLSearchParams,
    window: { location: {
      hash: "#access_token=synthetic-access&refresh_token=synthetic-refresh",
      pathname: "/es/auth/callback", search: "?synthetic=1",
      replace(value) { destination = value; },
    } },
    fetch: async (url, options) => {
      submitted = { url, ...options, body: JSON.parse(options.body) };
      if (fetchError) throw new Error("synthetic failure");
      return { json: async () => ({ redirectTo }) };
    },
  });
  return { submitted, destination };
}

test("allowed bridge redirects round-trip for all locales and allowed route families", async () => {
  for (const locale of locales) {
    for (const path of ["app", "app/work", "portal", "portal/orders", "update-password"]) {
      const h = harness();
      const next = `/${locale}/${path}`;
      const response = await h.get({ next }, locale);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /^text\/html/);
      const result = await runBridge(bridgeScript(await response.text()), { redirectTo: next });
      assert.equal(result.submitted.body.next, next);
      assert.equal(result.destination, next);
      assert.equal(result.submitted.method, "POST");
      assert.equal(result.submitted.credentials, "same-origin");
      assert.equal(result.submitted.body.access_token, "synthetic-access");
      assert.equal(result.submitted.body.refresh_token, "synthetic-refresh");
      assert.deepEqual(h.calls, []);
    }
  }
});

test("disallowed or absent redirects keep the existing locale Portal fallback", async () => {
  for (const next of [undefined, "https://example.test/app", "//example.test", "/es/application", "/it/app", "/es/platform"]) {
    const response = await harness().get({ next });
    const result = await runBridge(bridgeScript(await response.text()));
    assert.equal(result.submitted.body.next, "/es/portal");
    assert.equal(result.destination, "/es/login?status=authCallbackError");
  }
});

test("HTML boundary markers remain data inside the single intended script", async () => {
  for (const suffix of [
    '</script><script type="application/json">{"marker":"INERT_BOUNDARY"}</script>',
    "</ScRiPt ><template>INERT_BOUNDARY</template>",
    "<!--<script>INERT_BOUNDARY</script>-->",
    '<>&"\'\\\n\u2028\u2029 INERT_BOUNDARY',
  ]) {
    const next = `/es/app/${suffix}`;
    const response = await harness().get({ next });
    const html = await response.text();
    const script = bridgeScript(html);
    assert.equal((html.match(/<\/script\s*>/gi) ?? []).length, 1);
    assert.equal((html.match(/<script\b/gi) ?? []).length, 1);
    assert.doesNotMatch(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ""), /INERT_BOUNDARY/);
    const result = await runBridge(script);
    assert.equal(result.submitted.body.next, next, "encoding must preserve the original data");
  }
});

test("bridge network failures retain the localized login fallback", async () => {
  const response = await harness().get({ next: "/es/app/work" });
  const result = await runBridge(bridgeScript(await response.text()), { fetchError: true });
  assert.equal(result.destination, "/es/login?status=authCallbackError");
});

test("invalid locale keeps the existing English fallback", async () => {
  const response = await harness().get({ next: "/es/app" }, "invalid");
  const html = await response.text();
  assert.match(html, /<html lang="en">/);
  assert.equal((await runBridge(bridgeScript(html))).submitted.body.next, "/en/portal");
});

test("GET code exchange persists cookies and redirects to the allowed destination", async () => {
  const h = harness();
  const response = await h.get({ next: "/es/app/work", code: "synthetic-code" });
  assert.equal(response.headers.get("location"), "https://example.test/es/app/work");
  assert.equal(h.calls[0].name, "exchangeCodeForSession");
  assert.equal(h.calls[0].value, "synthetic-code");
  assert.equal(response.cookies.values[0][0], "synthetic-session");
});

test("GET invitation and recovery OTP paths retain exchange and recovery semantics", async () => {
  for (const type of ["invite", "recovery"]) {
    const h = harness();
    const next = type === "recovery" ? "/es/update-password" : "/es/app/work";
    const response = await h.get({ next, tokenHash: "synthetic-hash", type });
    assert.equal(h.calls[0].name, "verifyOtp");
    assert.equal(h.calls[0].value.type, type);
    assert.equal(h.calls[0].value.token_hash, "synthetic-hash");
    assert.equal(response.headers.get("location"), `https://example.test${next}`);
    const recovery = response.cookies.values.find(([name]) => name === "ecowash-password-recovery");
    assert.equal(Boolean(recovery), type === "recovery");
    if (recovery) {
      assert.equal(recovery[2].httpOnly, true);
      assert.equal(recovery[2].secure, true);
      assert.equal(recovery[2].sameSite, "lax");
      assert.equal(recovery[2].maxAge, 900);
    }
  }
});

test("GET failed exchange clears the local session and redirects to login", async () => {
  const h = harness({ authError: { code: "synthetic-failure" } });
  const response = await h.get({ code: "synthetic-code", next: "/es/update-password" });
  assert.equal(response.headers.get("location"), "https://example.test/es/login?status=authCallbackError");
  assert.equal(h.calls[1].name, "signOut");
  assert.equal(h.calls[1].value.scope, "local");
  assert.ok(!response.cookies.values.some(([name]) => name === "ecowash-password-recovery"));
});

test("POST persists the submitted session and preserves recovery and redirect fallback", async () => {
  for (const next of ["/es/app/work", "/es/update-password", "//example.test"]) {
    const h = harness();
    const response = await h.post({ body: { access_token: "synthetic-access", refresh_token: "synthetic-refresh", next } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).redirectTo, next.startsWith("//") ? "/es/portal" : next);
    assert.equal(h.calls[0].name, "setSession");
    assert.equal(h.calls[0].value.access_token, "synthetic-access");
    assert.equal(h.calls[0].value.refresh_token, "synthetic-refresh");
    assert.equal(response.cookies.values[0][0], "synthetic-session");
    assert.equal(response.cookies.values.some(([name]) => name === "ecowash-password-recovery"), next === "/es/update-password");
  }
});

test("POST malformed JSON, missing tokens and failed persistence retain error behavior", async () => {
  for (const scenario of ["json", "tokens", "session"]) {
    const h = harness({ authError: scenario === "session" ? { code: "synthetic-failure" } : null });
    const response = await h.post({ invalidJson: scenario === "json", body: scenario === "tokens" ? {} : {
      access_token: "synthetic-access", refresh_token: "synthetic-refresh", next: "/es/update-password",
    } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).redirectTo, "/es/login?status=authCallbackError");
    assert.equal(h.calls.filter(call => call.name === "signOut").length, scenario === "json" ? 0 : 1);
    assert.ok(!response.cookies.values.some(([name]) => name === "ecowash-password-recovery"));
  }
});
