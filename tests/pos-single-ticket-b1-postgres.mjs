// Fixed existing synthetic Billing database only. Everything, including the
// migration and source-fixture extensions, is rolled back in one connection.
// No creation/deletion of databases, no Supabase runtime, no issue/payment RPC.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

assert.ok(process.argv.includes("--authorized-ticket-settings-lab"), "Explicit isolated-lab opt-in required");
const daemon = "unix:///Users/cristianomegale/.docker/run/docker.sock";
const container = "phoenix-billing-pg-test-20261118", database = "phoenix_billing_issue_test_001";
const inspect = spawnSync("docker", ["--host", daemon, "inspect", "--format", "{{.Name}}|{{.State.Running}}", container], { encoding: "utf8", timeout: 10000 });
assert.equal(inspect.status, 0, inspect.stderr); assert.equal(inspect.stdout.trim(), `/${container}|true`);
function query(sql) {
  const result = spawnSync("docker", ["--host", daemon, "exec", "-i", container, "env", "-i", "PATH=/usr/local/bin:/usr/bin:/bin",
    "psql", "-X", "-w", "-q", "-h", "/var/run/postgresql", "-p", "5432", "-U", "postgres", "-d", database,
    "-At", "-v", "ON_ERROR_STOP=1"], { encoding: "utf8", timeout: 30000,
    input: "set statement_timeout='10s'; set lock_timeout='3s';\n" + sql });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
assert.equal(query("select current_database() || '|' || current_user || '|' || (inet_server_addr() is null)::text;"), `${database}|postgres|true`);
assert.equal(query("show server_version_num;"), "170006");
assert.match(query("select pg_get_functiondef('public.app_current_organization_id()'::regprocedure);"), /test\.org/,
  "Controlled synthetic Auth fixture required, never an application database");
assert.equal(query("select count(*) from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='ticket_footer';"), "0");
const fingerprint = () => query(["organizations", "invoices", "invoice_orders", "payments", "billing_invoice_number_counters", "organization_billing_settings"].map(table =>
  `select '${table}:' || md5(coalesce(string_agg(row_to_json(t)::text, '|' order by row_to_json(t)::text), '')) from public.${table} t;`).join("\n"));
const before = fingerprint();
const migration = readFileSync(new URL("../supabase/migrations/20261119184201_pos_single_ticket_settings_001.sql", import.meta.url), "utf8")
  .replace(/^begin;\s*$/m, "").replace(/^commit;\s*$/m, "");
const result = query(`begin;
  -- Synthetic source fixtures only; Billing DDL/RPCs remain real.
  alter table public.orders add column if not exists due_at timestamptz;
  create table public.pickups(organization_id uuid, order_id uuid, status text, scheduled_at timestamptz, created_at timestamptz default now());
  create table public.deliveries(like public.pickups including defaults);
  ${migration}
  set test.org='00000000-0000-4000-8000-000000019001'; set test.role='owner'; set test.billing='true'; set test.pos='true';
  insert into public.organizations(id,name,timezone) values
    ('00000000-0000-4000-8000-000000019001','Ticket tenant A','Atlantic/Canary'),
    ('00000000-0000-4000-8000-000000019002','Ticket tenant B','Atlantic/Canary');
  set role authenticated;
  select public.update_current_ticket_settings(E'Tenant A first line\nTenant A second line');
  select public.update_current_ticket_settings(null, 'a-s', true);
  reset role;
  do $$ begin
    assert (select simplified_series = 'A-S' from public.organization_billing_settings where organization_id=public.app_current_organization_id());
    assert (select ticket_footer = E'Tenant A first line\nTenant A second line' from public.organizations where id=public.app_current_organization_id());
    assert (select ticket_footer is null from public.organizations where id='00000000-0000-4000-8000-000000019002');
    assert not has_function_privilege('anon','public.update_current_ticket_settings(text,text,boolean)','execute');
    assert not has_function_privilege('authenticated','public.snapshot_ticket_presentation()','execute');
    begin perform public.update_current_ticket_settings('x','A',true); raise exception 'ordinary series accepted'; exception when check_violation then null; end;
    begin perform public.update_current_ticket_settings('x','BAD/1',true); raise exception 'bad series accepted'; exception when invalid_parameter_value then null; end;
    begin perform public.update_current_ticket_settings(repeat('x',4001),'S'); raise exception 'long footer accepted'; exception when invalid_parameter_value then null; end;
  end $$;
  set test.role='manager';
  do $$ begin begin perform public.update_current_ticket_settings('x','S'); raise exception 'manager accepted'; exception when insufficient_privilege then null; end; end $$;
  set test.role='staff';
  do $$ begin begin perform public.update_current_ticket_settings('x','S'); raise exception 'staff accepted'; exception when insufficient_privilege then null; end; end $$;
  set test.role='owner'; set test.billing='false';
  do $$ begin begin perform public.update_current_ticket_settings('x','NEW-S',true); raise exception 'missing entitlement accepted'; exception when insufficient_privilege then null; end; end $$;
  -- Reproduce an Owner whose existing series is hidden by entitlement RLS.
  alter policy organization_billing_settings_select_management on public.organization_billing_settings
    using (public.has_organization_role(organization_id, array['owner','manager']::public.app_role[])
      and public.organization_entitlement_is_enabled(organization_id, 'billing.invoicing', now()));
  create temporary table b1_series_before as select row_to_json(s)::text as snapshot
    from public.organization_billing_settings s where organization_id=public.app_current_organization_id();
  set role authenticated;
  do $$ declare attempted text; begin
    assert (select count(*)=0 from public.organization_billing_settings where organization_id=public.app_current_organization_id()), 'Billing series must actually be hidden by RLS';
    perform public.update_current_ticket_settings('Footer without Billing');
    -- An irrelevant/forged series field in a footer request is never applied.
    perform public.update_current_ticket_settings('Footer still without Billing','BAD/IGNORED');
    foreach attempted in array array[null::text, 'NEW-S', 'A-S'] loop
      begin perform public.update_current_ticket_settings('Must not change footer',attempted,true);
        raise exception 'series write without Billing accepted';
      exception when insufficient_privilege then null; end;
    end loop;
  end $$;
  reset role;
  do $$ begin
    assert (select ticket_footer='Footer still without Billing' from public.organizations where id=public.app_current_organization_id());
    assert (select row_to_json(s)::text=(select snapshot from b1_series_before)
      from public.organization_billing_settings s where organization_id=public.app_current_organization_id()), 'Hidden Billing row changed';
    assert (select ticket_footer is null from public.organizations where id='00000000-0000-4000-8000-000000019002');
  end $$;
  select public.update_current_ticket_settings(E'Tenant A first line\nTenant A second line');
  set test.billing='true';
  -- Real draft builder exercises the new INSERT triggers without payment/issue.
  insert into public.customers(id, organization_id, customer_code, display_name, tax_id, billing_address_line1, billing_city, billing_postal_code, billing_country_code)
  values('00000000-0000-4000-8000-000000019101',public.app_current_organization_id(),'B1-NAMED','Stored customer','NIF','Street','City','00000','ES');
  insert into public.orders(id,organization_id,customer_id,subtotal,discount_amount,total,due_at)
  values('00000000-0000-4000-8000-000000019201',public.app_current_organization_id(),'00000000-0000-4000-8000-000000019101',14,1,13,'2026-11-20T10:00:00Z');
  insert into public.order_items(id,organization_id,order_id,quantity,unit_price,line_total)
  values('00000000-0000-4000-8000-000000019301',public.app_current_organization_id(),'00000000-0000-4000-8000-000000019201',2,7,14);
  insert into public.deliveries(organization_id,order_id,status,scheduled_at) values
    (public.app_current_organization_id(),'00000000-0000-4000-8000-000000019201','scheduled','2026-11-21T12:00:00Z');
  do $$ begin
    begin perform public.create_billing_draft(array['00000000-0000-4000-8000-000000019201'::uuid],'A-S',7,null);
      raise exception 'ordinary use of empty reserved series accepted';
    exception when others then if sqlerrm <> 'billing_series_document_type_conflict' then raise; end if; end;
  end $$;
  select set_config('app.billing_mutation','on',true);
  do $$ declare draft uuid; begin
    draft := public.create_billing_draft_for_type(array['00000000-0000-4000-8000-000000019201'::uuid],'A-S',7,null,'simplificada');
    assert (select ticket_footer = E'Tenant A first line\nTenant A second line' and invoice_number is null and total=13 and tax_total=.85 from public.invoices where id=draft);
    assert (select (ticket_schedule->>'readyAt')::timestamptz='2026-11-20T10:00:00Z' and ticket_schedule->>'pickupAt' is null
      and (ticket_schedule->>'deliveryAt')::timestamptz='2026-11-21T12:00:00Z' from public.invoice_orders where invoice_id=draft);
    perform public.update_current_ticket_settings('Changed current note');
    update public.orders set due_at='2026-11-25T10:00:00Z' where id='00000000-0000-4000-8000-000000019201';
    assert (select ticket_footer <> 'Changed current note' from public.invoices where id=draft);
    assert (select (ticket_schedule->>'readyAt')::timestamptz='2026-11-20T10:00:00Z' from public.invoice_orders where invoice_id=draft);
    begin perform public.update_current_ticket_settings('x','A',true); raise exception 'ordinary default collision accepted'; exception when check_violation then null; end;
    begin update public.organization_billing_settings set default_series='A-S' where organization_id=public.app_current_organization_id(); raise exception 'ordinary settings collision accepted'; exception when check_violation then null; end;
    begin update public.invoices set fiscal_document_type='ordinaria',series='A-S' where id=draft;
      raise exception 'ordinary invoice reservation bypass'; exception when others then if sqlerrm not in ('billing_simplified_conversion_forbidden','billing_series_document_type_conflict') then raise; end if; end;
  end $$;
  set test.org='00000000-0000-4000-8000-000000019002';
  select public.update_current_ticket_settings('Tenant B note', null);
  do $$ begin
    assert (select ticket_footer='Tenant B note' from public.organizations where id=public.app_current_organization_id());
    assert not exists(select 1 from public.organization_billing_settings where organization_id=public.app_current_organization_id());
  end $$;
  rollback;
  select 'B1_SQL_ROLLBACK_PASS';`);
assert.match(result, /B1_SQL_ROLLBACK_PASS/);
assert.equal(fingerprint(), before, "All existing data and fixture additions must be rolled back");
assert.equal(query("select count(*) from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='ticket_footer';"), "0");
console.log("B1_POSTGRES_PASS: real additive DDL/settings RPC/reservation and snapshot triggers; role/tenant/entitlement synthetic fixtures; rollback and original data hashes verified; footer save with hidden RLS series and explicit series denial without Billing; no issue/payment RPC");
