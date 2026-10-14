-- Run only after loading the staging schema snapshot and the proposed
-- migration into a disposable local database. Never run on staging.
do $$ begin
  if current_database() <> 'phoenix_portal_entitlement_test' then
    raise exception 'disposable_database_required';
  end if;
end $$;

begin;

insert into public.platform_feature_catalog (feature_key, category, description)
values ('core.portal', 'core', 'Authenticated Customer Portal');

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'portal-local-test@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'owner-local-test@example.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'disabled-local-test@example.invalid');

insert into public.profiles (id, display_name)
values ('22222222-2222-4222-8222-222222222222', 'Local test owner')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, default_currency, timezone)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Local A', 'portal-local-a', 'EUR', 'Atlantic/Canary'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Local B', 'portal-local-b', 'EUR', 'Atlantic/Canary');

insert into public.customers (id, organization_id, customer_type, display_name)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'individual', 'Local A customer'),
  ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'individual', 'Local B customer'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'individual', 'Disabled B customer');

insert into public.locations (organization_id, name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Local A counter');

insert into public.organization_memberships (organization_id, profile_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'owner');

insert into public.customer_portal_access
  (organization_id, customer_id, user_id, email, created_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'portal-local-test@example.invalid', now() - interval '1 day'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
   '11111111-1111-4111-8111-111111111111', 'portal-local-test@example.invalid', now());

insert into public.customer_portal_access
  (organization_id, customer_id, user_id, email, is_active, disabled_by, disabled_at)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
   '33333333-3333-4333-8333-333333333333', 'disabled-local-test@example.invalid',
   false, '22222222-2222-4222-8222-222222222222', now());

insert into public.organization_entitlements (organization_id, feature_key, enabled)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'core.portal', false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'core.portal', true);

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

-- First active context is denied; later entitled B must not be selected.
do $$ begin
  if exists (select 1 from public.customer_portal_current_access())
    or exists (select 1 from public.list_customer_portal_services())
    or exists (select 1 from public.get_customer_portal_ordering_context())
    or exists (select 1 from public.customer_portal_access)
    or public.is_customer_portal_user_for_organization('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'disabled_context_leaked_or_switched';
  end if;
end $$;

do $$ begin
  begin
    perform public.create_customer_portal_order_request(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '[]'::jsonb, now()::timestamp + interval '1 day', null);
    raise exception 'disabled_request_accepted';
  exception when others then
    if sqlerrm <> 'portal_request_unauthorized' then raise; end if;
  end;
  begin
    perform public.create_customer_portal_order_request_catalog_001(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '[]'::jsonb, now()::timestamp + interval '1 day', null);
    raise exception 'disabled_inner_request_accepted';
  exception when others then
    if sqlerrm <> 'portal_request_unauthorized' then raise; end if;
  end;
  begin
    perform public.get_catalog_presentation('es', array[]::uuid[]);
    raise exception 'disabled_catalog_presentation_accepted';
  exception when others then
    if sqlerrm <> 'catalog_presentation_denied' then raise; end if;
  end;
  begin
    perform public.get_customer_portal_online_payment_availability(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    raise exception 'disabled_payment_read_accepted';
  exception when others then
    if sqlerrm <> 'customer_portal_access_required' then raise; end if;
  end;
end $$;

-- A user with only an inactive grant cannot use an entitled tenant.
reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
set role authenticated;
do $$ begin
  if exists (select 1 from public.customer_portal_current_access()) then
    raise exception 'inactive_access_allowed';
  end if;
end $$;

reset role;
update public.organization_entitlements
set enabled = true
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ declare selected_org uuid; begin
  select organization_id into selected_org from public.customer_portal_current_access();
  if selected_org is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'entitled_first_context_not_selected';
  end if;
  if (select count(*) from public.customer_portal_access) <> 1 then
    raise exception 'direct_portal_access_scope_wrong';
  end if;
  begin
    perform public.create_customer_portal_order_request(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '[]'::jsonb, now()::timestamp + interval '1 day', null);
    raise exception 'invalid_property_accepted';
  exception when others then
    -- Reaching property validation proves both order RPC layers passed the
    -- entitlement boundary without creating an Order.
    if sqlerrm <> 'portal_request_invalid_property' then raise; end if;
  end;
end $$;

reset role;
update public.organization_entitlements
set valid_until = now() - interval '1 minute'
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ begin
  if exists (select 1 from public.customer_portal_current_access()) then
    raise exception 'expired_entitlement_allowed';
  end if;
end $$;

reset role;
update public.organization_entitlements
set valid_from = now() + interval '1 day', valid_until = null
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ begin
  if exists (select 1 from public.customer_portal_current_access()) then
    raise exception 'not_yet_effective_entitlement_allowed';
  end if;
end $$;

reset role;
delete from public.organization_entitlements
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ begin
  if exists (select 1 from public.customer_portal_current_access()) then
    raise exception 'missing_entitlement_allowed';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  if exists (select 1 from public.customer_portal_current_access()) then
    raise exception 'unauthenticated_portal_access_allowed';
  end if;
end $$;

-- Owner can inspect and disable existing access while entitlement is absent,
-- but cannot grant or re-enable it.
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
set role authenticated;
do $$ declare access_id uuid; begin
  select id into access_id from public.customer_portal_access
  where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if access_id is null then raise exception 'owner_cannot_inspect'; end if;
  begin
    perform public.upsert_customer_portal_access(
      'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111', 'portal-local-test@example.invalid');
    raise exception 'owner_grant_allowed_without_entitlement';
  exception when others then
    if sqlerrm <> 'portal_entitlement_required' then raise; end if;
  end;
  begin
    perform public.upsert_customer_portal_access(
      'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111', 'portal-local-test@example.invalid');
    raise exception 'foreign_grant_allowed';
  exception when others then
    if sqlerrm <> 'not authorized' then raise; end if;
  end;
  perform public.update_customer_portal_access(access_id, false);
  begin
    perform public.update_customer_portal_access(access_id, true);
    raise exception 'owner_reenable_allowed_without_entitlement';
  exception when others then
    if sqlerrm <> 'portal_entitlement_required' then raise; end if;
  end;
end $$;

reset role;
do $$ begin
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'customer_portal_current_access',
        'create_customer_portal_order_request',
        'upsert_customer_portal_access',
        'update_customer_portal_access'
      )
      and (not procedure.prosecdef or pg_get_userbyid(procedure.proowner) <> 'postgres')
  ) then raise exception 'function_security_or_owner_changed'; end if;
  if (select count(*) from public.customer_portal_access) <> 3
    or (select count(*) from public.customers) <> 3
    or (select count(*) from public.orders) <> 0 then
    raise exception 'historical_fixture_data_changed';
  end if;
end $$;

rollback;
select 'PORTAL_ENTITLEMENT_BOUNDARY_001_SQL_PASS' as result;
