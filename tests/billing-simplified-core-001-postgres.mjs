// Explicit local integration check: node tests/billing-simplified-core-001-postgres.mjs
// Uses a cached postgres:17 image, no network, host ports, mounted data or tenants.
// Billing DDL/RPCs are real repository SQL. Auth/entitlement resolvers and source
// tables are controlled fixtures; this is not a full Supabase/RLS acceptance test.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const name = `phoenix-simplified-core-${randomUUID()}`;
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 60000 });
  if (result.error || result.status !== 0) {
    throw new Error(`${args[0]} failed: ${result.error?.message ?? result.stderr}`);
  }
  return result.stdout;
}
const query = (sql) => docker(["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], sql);
const org = "00000000-0000-4000-8000-000000000001";
const customer = "00000000-0000-4000-8000-000000000002";
const order = "00000000-0000-4000-8000-000000000003";
const auth = `select set_config('test.org', '${org}', false);
  select set_config('test.role', 'owner', false);
  select set_config('test.entitled', 'true', false);`;
const expectError = (statement, expected) => `
  do $test$ begin
    begin ${statement};
    exception when others then
      if sqlerrm = '${expected}' then return; end if;
      raise;
    end;
    raise exception 'Expected ${expected}';
  end $test$;`;

try {
  docker(["run", "--detach", "--rm", "--pull=never", "--name", name, "--network=none",
    "--tmpfs", "/var/lib/postgresql/data", "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]);
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], { encoding: "utf8" });
    if (status.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "isolated PostgreSQL did not start");
  query(`
    create role anon;
    create role authenticated;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create schema auth;
    create type public.app_role as enum ('owner', 'manager', 'staff');
    create type public.service_unit_type as enum ('piece', 'weight');
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function public.app_current_organization_id() returns uuid language sql as $$
      select current_setting('test.org')::uuid $$;
    create function public.has_organization_role(org uuid, roles public.app_role[]) returns boolean language sql as $$
      select org = public.app_current_organization_id() and current_setting('test.role')::public.app_role = any(roles) $$;
    create function public.organization_entitlement_is_enabled(uuid, text, timestamptz) returns boolean language sql as $$
      select current_setting('test.entitled')::boolean $$;
    create function public.set_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at := now(); return new; end $$;
    create table public.organizations (id uuid primary key, name text);
    create table public.profiles (id uuid primary key);
    create table public.customers (
      id uuid primary key, organization_id uuid, customer_code text, customer_type text,
      display_name text, company_name text, tax_id text, billing_address_line1 text,
      billing_address_line2 text, billing_city text, billing_postal_code text, billing_country_code char(2),
      email text, unique(organization_id, id)
    );
    create table public.orders (
      id uuid primary key, organization_id uuid, customer_id uuid, currency text default 'EUR',
      is_active boolean default true, production_status text default 'received', created_at timestamptz default now(),
      subtotal numeric default 10, discount_amount numeric default 2, total numeric default 8,
      unique(organization_id, id)
    );
    create table public.order_items (
      id uuid primary key, organization_id uuid, order_id uuid, is_active boolean default true,
      description text default 'Laundry', unit_type public.service_unit_type default 'piece',
      quantity numeric default 2, unit_price numeric default 5, line_total numeric default 10,
      sort_order int default 1, created_at timestamptz default now()
    );
    create table public.organization_branding (
      organization_id uuid, commercial_name text, business_address text,
      support_email text, support_phone text, logo_path text
    );
  `);
  query(read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql"));
  query(read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql"));
  query(read("supabase/migrations/20261118125229_billing_issue_idempotency_001.sql"));
  const entitlements = read("supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql");
  query(entitlements.slice(entitlements.indexOf("create function public.require_billing_entitlement()"),
    entitlements.indexOf("drop policy if exists organization_billing_settings_select_management")));
  query(`${auth}
    insert into public.organizations values ('${org}', 'Isolated fixture');
    insert into public.customers (id, organization_id, customer_code, customer_type, display_name)
      values ('${customer}', '${org}', 'WALKIN-SHARED', 'individual', 'Walk-in customer');
    insert into public.orders (id, organization_id, customer_id) values ('${order}', '${org}', '${customer}');
    insert into public.order_items (id, organization_id, order_id)
      values ('00000000-0000-4000-8000-000000000004', '${org}', '${order}');
    insert into public.organization_billing_settings
      (organization_id, issuer_legal_name, issuer_tax_id, issuer_address_line1, issuer_city,
       issuer_postal_code, issuer_country_code, default_tax_rate)
      values ('${org}', 'Fixture issuer', 'FIXTURE', 'Street', 'City', '00000', 'ES', 7);
  `);
  // Create one ordinary draft before applying the new migration: historical
  // interpretation and canonical creation math are exercised, not reimplemented.
  const draft = query(`${auth} select public.create_billing_draft(array['${order}']::uuid[]);`).trim().split("\n").at(-1);
  assert.match(draft, /^[0-9a-f-]{36}$/);
  query(read("supabase/migrations/20261118175639_billing_simplified_core_001.sql"));
  assert.equal(query(`select fiscal_document_type from public.invoices where id = '${draft}';`).trim(), "ordinaria");

  query(`${auth}
    ${expectError(`perform public.issue_billing_invoice('${draft}')`, "billing_customer_configuration_required")}
    ${expectError(`perform public.prepare_simplified_billing_draft('${draft}', 'A')`, "billing_series_document_type_conflict")}
    select set_config('test.role', 'staff', false);
    ${expectError(`perform public.prepare_simplified_billing_draft('${draft}', 'S')`, "billing_not_authorized")}
    select set_config('test.role', 'manager', false);
    select set_config('test.entitled', 'false', false);
    ${expectError(`perform public.prepare_simplified_billing_draft('${draft}', 'S')`, "billing_entitlement_required")}
    select set_config('test.entitled', 'true', false);
    select set_config('test.org', '00000000-0000-4000-8000-000000000099', false);
    ${expectError(`perform public.prepare_simplified_billing_draft('${draft}', 'S')`, "billing_invalid_draft")}
    select set_config('test.org', '${org}', false);
    set role authenticated;
    select public.prepare_simplified_billing_draft('${draft}', 'S');
    reset role;
  `);
  const prepared = JSON.parse(query(`select row_to_json(i) from public.invoices i where id = '${draft}';`).trim());
  assert.equal(prepared.fiscal_document_type, "simplificada");
  assert.equal(prepared.customer_name, null);
  assert.equal(prepared.customer_id, customer);
  assert.equal(prepared.total, 8);
  assert.equal(prepared.taxable_base, 7.48);
  assert.equal(prepared.tax_total, 0.52);
  assert.equal(prepared.invoice_number, null);
  assert.equal(query("select count(*) from public.billing_invoice_number_counters;").trim(), "0");
  query(`${auth}
    begin;
    select set_config('app.billing_mutation', 'on', true);
    ${expectError(`update public.invoices set document_status = 'issued', invoice_number = 'FORBIDDEN',
      sequence_number = 1, issued_at = now() where id = '${draft}'`, "billing_simplified_fiscal_use_disabled")}
    ${expectError(`update public.invoices set fiscal_document_type = 'ordinaria' where id = '${draft}'`, "billing_simplified_conversion_forbidden")}
    ${expectError(`update public.invoices set customer_tax_id = 'INVENTED' where id = '${draft}'`,
      'new row for relation "invoices" violates check constraint "invoices_omitted_recipient_consistent"')}
    rollback;
  `);

  // Ordinary first issue, retry and historical immutability remain real RPC
  // operations. Only this disposable fixture customer is given fiscal data.
  const ordinaryOrder = "00000000-0000-4000-8000-000000000005";
  query(`${auth}
    update public.customers set customer_code = 'C-1', display_name = 'Named fixture',
      billing_address_line1 = 'Street', billing_city = 'City', billing_postal_code = '00000', billing_country_code = 'ES';
    insert into public.orders (id, organization_id, customer_id) values ('${ordinaryOrder}', '${org}', '${customer}');
    insert into public.order_items (id, organization_id, order_id)
      values ('00000000-0000-4000-8000-000000000006', '${org}', '${ordinaryOrder}');
  `);
  const ordinary = query(`${auth} select public.create_billing_draft(array['${ordinaryOrder}']::uuid[]);`).trim().split("\n").at(-1);
  query(`${auth}
    begin;
    select set_config('app.billing_mutation', 'on', true);
    ${expectError(`update public.invoices set series = 'S' where id = '${ordinary}'`, "billing_series_document_type_conflict")}
    rollback;
  `);
  const issued = query(`${auth} select * from public.issue_billing_invoice('${ordinary}');`).trim().split("\n").at(-1);
  const beforeRetry = query(`select row_to_json(i) from public.invoices i where id = '${ordinary}';`).trim();
  const retried = query(`${auth} select * from public.issue_billing_invoice('${ordinary}');`).trim().split("\n").at(-1);
  assert.equal(retried, issued);
  assert.equal(query(`select row_to_json(i) from public.invoices i where id = '${ordinary}';`).trim(), beforeRetry);
  assert.equal(query("select next_value from public.billing_invoice_number_counters where series = 'A';").trim(), "2");
  query(`${auth}
    begin;
    select set_config('app.billing_mutation', 'on', true);
    ${expectError(`update public.invoices set fiscal_document_type = 'simplificada' where id = '${ordinary}'`, "billing_issued_snapshot_immutable")}
    rollback;
    select public.cancel_billing_invoice('${ordinary}', 'Fixture cancellation');
    ${expectError(`perform public.prepare_simplified_billing_draft('${ordinary}', 'S')`, "billing_invalid_draft")}
  `);
  console.log("PASS PostgreSQL 17: migration, legacy ordinary default, anonymous snapshot, inclusive totals,");
  console.log("role/entitlement/tenant guards with controlled resolvers, distinct series, disabled fiscal use,");
  console.log("ordinary first issue/retry/counter/snapshot, immutability and cancelled rejection.");
  console.log("Not exercised: full Supabase identity/RLS, competing sessions, tax-law eligibility or UI E2E.");
} finally {
  docker(["rm", "--force", name]);
}
